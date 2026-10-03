pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
pub use instructions::*;
use instructions::{
    contribute::Contribute, create_circle::CreateCircle, init_config::InitConfig,
    join_circle::JoinCircle,
};
pub use state::*;

declare_id!("B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw");

#[program]
pub mod ajo_circles {
    use super::*;
    pub fn init_config(ctx: Context<InitConfig>, fee_bps: u16, min_period_secs: i64) -> Result<()> {
        init_config::process(ctx, fee_bps, min_period_secs)
    }
    pub fn create_circle(
        ctx: Context<CreateCircle>,
        circle_id: u64,
        name: String,
        contribution: u64,
        period_secs: i64,
        max_members: u8,
    ) -> Result<()> {
        create_circle::process(ctx, circle_id, name, contribution, period_secs, max_members)
    }
    pub fn join_circle(ctx: Context<JoinCircle>, slot: u8) -> Result<()> {
        join_circle::process(ctx, slot)
    }
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        contribute::process(ctx)
    }
}
