use crate::{
    constants::{CIRCLE_SEED, DEPOSIT_SEED, MEMBER_SEED, POT_SEED},
    error::ErrorCode,
    events::DefaultSettled,
    state::{Circle, Member},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct SettleDefault<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Account<'info, Circle>,
    #[account(mut, seeds = [MEMBER_SEED, circle.key().as_ref(), member.wallet.as_ref()], bump = member.bump, has_one = circle)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump, constraint = deposit_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub deposit_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [POT_SEED, circle.key().as_ref()], bump, constraint = pot_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub pot_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(address = circle.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process(ctx: Context<SettleDefault>) -> Result<()> {
    let c = &mut ctx.accounts.circle;
    require!(c.status.active(), ErrorCode::CircleNotActive);
    let deadline = c
        .round_start_ts
        .checked_add(c.period_secs)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        Clock::get()?.unix_timestamp > deadline,
        ErrorCode::DeadlineNotPassed
    );
    let bit = 1u16
        .checked_shl(u32::from(c.current_round))
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        ctx.accounts.member.paid_bitmask & bit == 0,
        ErrorCode::AlreadySettled
    );
    let covered = ctx.accounts.member.deposit_remaining.min(c.contribution);
    let shortfall = c
        .contribution
        .checked_sub(covered)
        .ok_or(ErrorCode::MathOverflow)?;
    if covered > 0 {
        let seeds: &[&[u8]] = &[
            CIRCLE_SEED,
            c.creator.as_ref(),
            &c.circle_id.to_le_bytes(),
            &[c.bump],
        ];
        let signer_seeds = [seeds];
        let cp = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.deposit_vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.pot_vault.to_account_info(),
                authority: c.to_account_info(),
            },
            &signer_seeds,
        );
        anchor_spl::token_interface::transfer_checked(cp, covered, ctx.accounts.mint.decimals)?;
    }
    ctx.accounts.member.deposit_remaining = ctx
        .accounts
        .member
        .deposit_remaining
        .checked_sub(covered)
        .ok_or(ErrorCode::MathOverflow)?;
    ctx.accounts.member.paid_bitmask |= bit;
    ctx.accounts.member.defaults = ctx
        .accounts
        .member
        .defaults
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    c.contributions_this_round = c
        .contributions_this_round
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    c.shortfall_total = c
        .shortfall_total
        .checked_add(shortfall)
        .ok_or(ErrorCode::MathOverflow)?;
    if ctx.accounts.member.defaults == 1 {
        c.eligible_members = c
            .eligible_members
            .checked_sub(1)
            .ok_or(ErrorCode::MathOverflow)?;
    }
    emit!(DefaultSettled {
        circle: c.key(),
        member: ctx.accounts.member.key(),
        round: c.current_round,
        covered,
        shortfall
    });
    Ok(())
}
