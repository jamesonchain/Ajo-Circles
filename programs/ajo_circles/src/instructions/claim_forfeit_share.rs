use crate::{
    constants::{CIRCLE_SEED, DEPOSIT_SEED, MEMBER_SEED},
    error::ErrorCode,
    state::{Circle, CircleStatus, Member},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct ClaimForfeitShare<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Account<'info, Circle>,
    #[account(mut, seeds = [MEMBER_SEED, circle.key().as_ref(), member.wallet.as_ref()], bump = member.bump, has_one = circle)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump, constraint = deposit_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub deposit_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = destination.mint == circle.mint @ ErrorCode::MintMismatch, constraint = destination.owner == member.wallet @ ErrorCode::TokenOwnerMismatch)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    #[account(address = circle.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process(ctx: Context<ClaimForfeitShare>) -> Result<()> {
    let c = &mut ctx.accounts.circle;
    require!(
        c.status == CircleStatus::Completed,
        ErrorCode::CircleNotCompleted
    );
    require!(ctx.accounts.member.defaults == 0, ErrorCode::NoForfeitShare);
    require!(
        !ctx.accounts.member.forfeit_claimed,
        ErrorCode::ForfeitShareAlreadyClaimed
    );
    require!(c.eligible_members > 0, ErrorCode::NoForfeitShare);
    let base = c
        .forfeit_total
        .checked_div(u64::from(c.eligible_members))
        .ok_or(ErrorCode::MathOverflow)?;
    let remainder = c
        .forfeit_total
        .checked_rem(u64::from(c.eligible_members))
        .ok_or(ErrorCode::MathOverflow)?;
    let amount = base
        .checked_add(if u64::from(c.forfeit_claims) < remainder {
            1
        } else {
            0
        })
        .ok_or(ErrorCode::MathOverflow)?;
    require!(amount > 0, ErrorCode::NoForfeitShare);
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
            to: ctx.accounts.destination.to_account_info(),
            authority: c.to_account_info(),
        },
        &signer_seeds,
    );
    anchor_spl::token_interface::transfer_checked(cp, amount, ctx.accounts.mint.decimals)?;
    c.forfeit_pool = c
        .forfeit_pool
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    c.forfeit_claims = c
        .forfeit_claims
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    ctx.accounts.member.forfeit_claimed = true;
    Ok(())
}
