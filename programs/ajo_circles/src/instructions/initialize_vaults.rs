use crate::{
    constants::*,
    error::ErrorCode,
    state::{Circle, CircleStatus},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct InitializePotVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, has_one = creator, seeds = [CIRCLE_SEED, creator.key().as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Box<Account<'info, Circle>>,
    #[account(address = circle.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init, payer = creator, token::mint = mint, token::authority = circle, seeds = [POT_SEED, circle.key().as_ref()], bump)]
    pub pot_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn process_pot(ctx: Context<InitializePotVault>) -> Result<()> {
    require!(
        ctx.accounts.circle.status == CircleStatus::Forming,
        ErrorCode::CircleNotForming
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeDepositVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, has_one = creator, seeds = [CIRCLE_SEED, creator.key().as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Box<Account<'info, Circle>>,
    #[account(address = circle.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init, payer = creator, token::mint = mint, token::authority = circle, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump)]
    pub deposit_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn process_deposit(ctx: Context<InitializeDepositVault>) -> Result<()> {
    require!(
        ctx.accounts.circle.status == CircleStatus::Forming,
        ErrorCode::CircleNotForming
    );
    Ok(())
}
