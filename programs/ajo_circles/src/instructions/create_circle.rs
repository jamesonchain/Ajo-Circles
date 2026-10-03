use crate::{
    constants::*,
    error::ErrorCode,
    events::CircleCreated,
    state::{Circle, CircleStatus, Config},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
#[derive(Accounts)]
#[instruction(circle_id: u64)]
pub struct CreateCircle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init, payer = creator, space = 8 + 32 + 8 + 4 + MAX_NAME_LEN + 32 + 8 + 8 + 1 + 1 + 2 + 1 + 1 + 8 + 1 + 8 + 8 + 1, seeds = [CIRCLE_SEED, creator.key().as_ref(), circle_id.to_le_bytes().as_ref()], bump)]
    pub circle: Box<Account<'info, Circle>>,
    #[account(init, payer = creator, token::mint = mint, token::authority = circle, seeds = [POT_SEED, circle.key().as_ref()], bump)]
    pub pot_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(init, payer = creator, token::mint = mint, token::authority = circle, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump)]
    pub deposit_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
pub fn process(
    ctx: Context<CreateCircle>,
    circle_id: u64,
    name: String,
    contribution: u64,
    period_secs: i64,
    max_members: u8,
) -> Result<()> {
    require!(
        name.as_bytes().len() <= MAX_NAME_LEN,
        ErrorCode::NameTooLong
    );
    require!(contribution > 0, ErrorCode::InvalidContribution);
    require!(
        period_secs >= ctx.accounts.config.min_period_secs,
        ErrorCode::PeriodTooShort
    );
    require!(
        (MIN_MEMBERS..=MAX_MEMBERS).contains(&max_members),
        ErrorCode::InvalidMemberCount
    );
    let c = &mut ctx.accounts.circle;
    c.creator = ctx.accounts.creator.key();
    c.circle_id = circle_id;
    c.name = name;
    c.mint = ctx.accounts.mint.key();
    c.contribution = contribution;
    c.period_secs = period_secs;
    c.max_members = max_members;
    c.member_count = 0;
    c.slots_taken = 0;
    c.status = CircleStatus::Forming;
    c.current_round = 0;
    c.round_start_ts = 0;
    c.contributions_this_round = 0;
    c.total_paid_out = 0;
    c.created_ts = Clock::get()?.unix_timestamp;
    c.bump = ctx.bumps.circle;
    emit!(CircleCreated {
        circle: c.key(),
        creator: c.creator,
        circle_id,
        contribution,
        max_members
    });
    Ok(())
}
