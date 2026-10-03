use crate::{
    constants::*,
    error::ErrorCode,
    events::Contributed,
    state::{Circle, Config, Member},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};
#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Account<'info, Circle>,
    #[account(mut, seeds = [MEMBER_SEED, circle.key().as_ref(), wallet.key().as_ref()], bump = member.bump, has_one = wallet, has_one = circle)]
    pub member: Account<'info, Member>,
    #[account(mut, constraint = source.mint == circle.mint @ ErrorCode::MintMismatch, constraint = source.owner == wallet.key() @ ErrorCode::TokenOwnerMismatch)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [POT_SEED, circle.key().as_ref()], bump, constraint = pot_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub pot_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(address = circle.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}
pub fn process(ctx: Context<Contribute>) -> Result<()> {
    let c = &mut ctx.accounts.circle;
    require!(c.status.active(), ErrorCode::CircleNotActive);
    let deadline = c
        .round_start_ts
        .checked_add(c.period_secs)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        Clock::get()?.unix_timestamp <= deadline,
        ErrorCode::DeadlinePassed
    );
    let bit = 1u16
        .checked_shl(u32::from(c.current_round))
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        ctx.accounts.member.paid_bitmask & bit == 0,
        ErrorCode::AlreadyPaid
    );
    let cp = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.source.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.pot_vault.to_account_info(),
            authority: ctx.accounts.wallet.to_account_info(),
        },
    );
    anchor_spl::token_interface::transfer_checked(cp, c.contribution, ctx.accounts.mint.decimals)?;
    ctx.accounts.member.paid_bitmask |= bit;
    c.contributions_this_round = c
        .contributions_this_round
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    emit!(Contributed {
        circle: c.key(),
        member: ctx.accounts.member.key(),
        round: c.current_round,
        amount: c.contribution
    });
    Ok(())
}
