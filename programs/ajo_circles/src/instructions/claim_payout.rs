use crate::{
    constants::{CIRCLE_SEED, CONFIG_SEED, DEPOSIT_SEED, MEMBER_SEED, POT_SEED},
    error::ErrorCode,
    events::{CircleCompleted, PayoutClaimed, PayoutForfeited},
    state::{Circle, CircleStatus, Config, Member},
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Box<Account<'info, Circle>>,
    #[account(mut, seeds = [MEMBER_SEED, circle.key().as_ref(), recipient_member.wallet.as_ref()], bump = recipient_member.bump, has_one = circle)]
    pub recipient_member: Box<Account<'info, Member>>,
    #[account(address = recipient_member.wallet)]
    pub recipient_wallet: SystemAccount<'info>,
    #[account(mut, seeds = [POT_SEED, circle.key().as_ref()], bump, constraint = pot_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub pot_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump, constraint = deposit_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub deposit_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = config.treasury, constraint = treasury.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = circle.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init_if_needed, payer = caller, associated_token::mint = mint, associated_token::authority = recipient_wallet, associated_token::token_program = token_program)]
    pub recipient_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn process(ctx: Context<ClaimPayout>) -> Result<()> {
    let c = &mut ctx.accounts.circle;
    require!(c.status.active(), ErrorCode::CircleNotActive);
    require!(c.member_count == c.max_members, ErrorCode::CircleNotFull);
    require!(
        !ctx.accounts.recipient_member.received,
        ErrorCode::PayoutAlreadyClaimed
    );
    require!(
        c.contributions_this_round == c.member_count,
        ErrorCode::PayoutNotReady
    );
    require!(
        ctx.accounts.recipient_member.slot == c.current_round,
        ErrorCode::WrongRecipient
    );
    let round = c.current_round;
    let pot_amount = ctx.accounts.pot_vault.amount;
    let seeds: &[&[u8]] = &[
        CIRCLE_SEED,
        c.creator.as_ref(),
        &c.circle_id.to_le_bytes(),
        &[c.bump],
    ];
    let signer_seeds = [seeds];
    if ctx.accounts.recipient_member.defaults > 0 {
        if pot_amount > 0 {
            let cp = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.pot_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.deposit_vault.to_account_info(),
                    authority: c.to_account_info(),
                },
                &signer_seeds,
            );
            anchor_spl::token_interface::transfer_checked(
                cp,
                pot_amount,
                ctx.accounts.mint.decimals,
            )?;
        }
        c.forfeit_pool = c
            .forfeit_pool
            .checked_add(pot_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        c.forfeit_total = c
            .forfeit_total
            .checked_add(pot_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.recipient_member.received = true;
        emit!(PayoutForfeited {
            circle: c.key(),
            member: ctx.accounts.recipient_member.key(),
            round,
            amount: pot_amount
        });
    } else {
        let fee_wide = u128::from(pot_amount)
            .checked_mul(u128::from(ctx.accounts.config.fee_bps))
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)?;
        let fee = u64::try_from(fee_wide).map_err(|_| ErrorCode::MathOverflow)?;
        let payout = pot_amount.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;
        if fee > 0 {
            let cp = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.pot_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: c.to_account_info(),
                },
                &signer_seeds,
            );
            anchor_spl::token_interface::transfer_checked(cp, fee, ctx.accounts.mint.decimals)?;
        }
        if payout > 0 {
            let cp = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.pot_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: c.to_account_info(),
                },
                &signer_seeds,
            );
            anchor_spl::token_interface::transfer_checked(cp, payout, ctx.accounts.mint.decimals)?;
        }
        c.total_paid_out = c
            .total_paid_out
            .checked_add(payout)
            .ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.recipient_member.received = true;
        emit!(PayoutClaimed {
            circle: c.key(),
            member: ctx.accounts.recipient_member.key(),
            round,
            amount: payout,
            fee
        });
    }
    let next_round = c
        .current_round
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    c.contributions_this_round = 0;
    if next_round >= c.max_members {
        c.current_round = c.max_members;
        c.status = CircleStatus::Completed;
        emit!(CircleCompleted {
            circle: c.key(),
            total_paid_out: c.total_paid_out,
            forfeit_pool: c.forfeit_pool
        });
    } else {
        c.current_round = next_round;
        c.round_start_ts = Clock::get()?.unix_timestamp;
    }
    Ok(())
}
