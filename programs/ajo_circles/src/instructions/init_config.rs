use crate::{constants::CONFIG_SEED, error::ErrorCode, state::Config};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + 32 + 32 + 2 + 32 + 8 + 1, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(constraint = treasury.mint == mint.key() @ ErrorCode::MintMismatch)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}
pub fn process(ctx: Context<InitConfig>, fee_bps: u16, min_period_secs: i64) -> Result<()> {
    require!(fee_bps <= 10_000, ErrorCode::InvalidFee);
    require!(min_period_secs > 0, ErrorCode::InvalidMinimumPeriod);
    let c = &mut ctx.accounts.config;
    c.admin = ctx.accounts.admin.key();
    c.mint = ctx.accounts.mint.key();
    c.fee_bps = fee_bps;
    c.treasury = ctx.accounts.treasury.key();
    c.min_period_secs = min_period_secs;
    c.bump = ctx.bumps.config;
    Ok(())
}
