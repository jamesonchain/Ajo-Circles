use crate::{
    constants::{CIRCLE_SEED, DEPOSIT_SEED, MEMBER_SEED},
    error::ErrorCode,
    events::DepositWithdrawn,
    state::{Circle, CircleStatus, Member},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct WithdrawDeposit<'info> {
    pub wallet: Signer<'info>,
    #[account(seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Account<'info, Circle>,
    #[account(mut, seeds = [MEMBER_SEED, circle.key().as_ref(), wallet.key().as_ref()], bump = member.bump, has_one = wallet, has_one = circle)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump, constraint = deposit_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub deposit_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = destination.mint == circle.mint @ ErrorCode::MintMismatch, constraint = destination.owner == wallet.key() @ ErrorCode::TokenOwnerMismatch)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    #[account(address = circle.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process(ctx: Context<WithdrawDeposit>) -> Result<()> {
    require!(
        ctx.accounts.circle.status == CircleStatus::Completed,
        ErrorCode::CircleNotCompleted
    );
    require!(
        !ctx.accounts.member.deposit_withdrawn,
        ErrorCode::DepositAlreadyWithdrawn
    );
    let amount = ctx.accounts.member.deposit_remaining;
    require!(amount > 0, ErrorCode::NoDeposit);
    let seeds: &[&[u8]] = &[
        CIRCLE_SEED,
        ctx.accounts.circle.creator.as_ref(),
        &ctx.accounts.circle.circle_id.to_le_bytes(),
        &[ctx.accounts.circle.bump],
    ];
    let signer_seeds = [seeds];
    let cp = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.deposit_vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.circle.to_account_info(),
        },
        &signer_seeds,
    );
    anchor_spl::token_interface::transfer_checked(cp, amount, ctx.accounts.mint.decimals)?;
    ctx.accounts.member.deposit_remaining = 0;
    ctx.accounts.member.deposit_withdrawn = true;
    emit!(DepositWithdrawn {
        circle: ctx.accounts.circle.key(),
        member: ctx.accounts.member.key(),
        amount
    });
    Ok(())
}
