use crate::{
    constants::*,
    error::ErrorCode,
    events::CircleCreated,
    state::{Circle, CircleStatus, Config},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
#[derive(Accounts)]
#[instruction(circle_id: u64)]
pub struct CreateCircle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init, payer = creator, space = 8 + 512, seeds = [CIRCLE_SEED, creator.key().as_ref(), circle_id.to_le_bytes().as_ref()], bump)]
    pub circle: Box<Account<'info, Circle>>,
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
    c.shortfall_total = 0;
    c.forfeit_pool = 0;
    c.forfeit_total = 0;
    c.forfeit_claims = 0;
    c.eligible_members = 0;
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
