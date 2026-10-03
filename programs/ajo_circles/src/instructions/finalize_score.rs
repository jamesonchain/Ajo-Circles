use crate::{
    constants::{CIRCLE_SEED, MEMBER_SEED},
    error::ErrorCode,
    events::ScoreUpdated,
    state::{AjoScore, Circle, CircleStatus, Member},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct FinalizeScore<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Account<'info, Circle>,
    #[account(mut, seeds = [MEMBER_SEED, circle.key().as_ref(), member.wallet.as_ref()], bump = member.bump, has_one = circle)]
    pub member: Account<'info, Member>,
    #[account(init_if_needed, payer = caller, space = 8 + 256, seeds = [b"score", member.wallet.as_ref()], bump)]
    pub score: Account<'info, AjoScore>,
    pub system_program: Program<'info, System>,
}

pub fn process(ctx: Context<FinalizeScore>) -> Result<()> {
    require!(
        ctx.accounts.circle.status == CircleStatus::Completed,
        ErrorCode::CircleNotCompleted
    );
    require!(
        !ctx.accounts.member.score_recorded,
        ErrorCode::ScoreAlreadyRecorded
    );
    let score = &mut ctx.accounts.score;
    if score.wallet == Pubkey::default() {
        score.wallet = ctx.accounts.member.wallet;
        score.bump = ctx.bumps.score;
    } else {
        require!(
            score.wallet == ctx.accounts.member.wallet,
            ErrorCode::MemberMismatch
        );
    }
    score.circles_joined = score
        .circles_joined
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    score.circles_completed = score
        .circles_completed
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    score.rounds_paid_on_time = score
        .rounds_paid_on_time
        .checked_add(u64::from(ctx.accounts.member.paid_on_time))
        .ok_or(ErrorCode::MathOverflow)?;
    score.rounds_defaulted = score
        .rounds_defaulted
        .checked_add(u64::from(ctx.accounts.member.defaults))
        .ok_or(ErrorCode::MathOverflow)?;
    score.total_contributed = score
        .total_contributed
        .checked_add(ctx.accounts.member.contributed_total)
        .ok_or(ErrorCode::MathOverflow)?;
    score.last_updated_ts = Clock::get()?.unix_timestamp;
    ctx.accounts.member.score_recorded = true;
    emit!(ScoreUpdated {
        wallet: score.wallet,
        circles_completed: score.circles_completed,
        rounds_paid_on_time: score.rounds_paid_on_time,
        rounds_defaulted: score.rounds_defaulted
    });
    Ok(())
}
