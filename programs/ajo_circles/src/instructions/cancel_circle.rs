use crate::{
    constants::CIRCLE_SEED,
    error::ErrorCode,
    events::CircleCancelled,
    state::{Circle, CircleStatus},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelCircle<'info> {
    pub creator: Signer<'info>,
    #[account(mut, has_one = creator, seeds = [CIRCLE_SEED, creator.key().as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Account<'info, Circle>,
}

pub fn process(ctx: Context<CancelCircle>) -> Result<()> {
    require!(
        ctx.accounts.circle.status == CircleStatus::Forming,
        ErrorCode::CircleNotForming
    );
    ctx.accounts.circle.status = CircleStatus::Cancelled;
    emit!(CircleCancelled {
        circle: ctx.accounts.circle.key(),
        creator: ctx.accounts.creator.key()
    });
    Ok(())
}
