use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
    pub min_period_secs: i64,
    pub bump: u8,
}
#[account]
pub struct Circle {
    pub creator: Pubkey,
    pub circle_id: u64,
    pub name: String,
    pub mint: Pubkey,
    pub contribution: u64,
    pub period_secs: i64,
    pub max_members: u8,
    pub member_count: u8,
    pub slots_taken: u16,
    pub status: CircleStatus,
    pub current_round: u8,
    pub round_start_ts: i64,
    pub contributions_this_round: u8,
    pub total_paid_out: u64,
    pub created_ts: i64,
    pub bump: u8,
    pub shortfall_total: u64,
    pub forfeit_pool: u64,
    pub forfeit_claims: u8,
    pub eligible_members: u8,
}
#[account]
pub struct Member {
    pub wallet: Pubkey,
    pub circle: Pubkey,
    pub slot: u8,
    pub deposit_total: u64,
    pub deposit_remaining: u64,
    pub paid_bitmask: u16,
    pub defaults: u8,
    pub received: bool,
    pub deposit_withdrawn: bool,
    pub score_recorded: bool,
    pub paid_on_time: u8,
    pub contributed_total: u64,
    pub forfeit_claimed: bool,
    pub bump: u8,
}

#[account]
pub struct AjoScore {
    pub wallet: Pubkey,
    pub circles_joined: u32,
    pub circles_completed: u32,
    pub rounds_paid_on_time: u64,
    pub rounds_defaulted: u64,
    pub total_contributed: u64,
    pub last_updated_ts: i64,
    pub bump: u8,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CircleStatus {
    Forming,
    Active,
    Completed,
    Cancelled,
}
impl CircleStatus {
    pub fn forming(&self) -> bool {
        matches!(self, Self::Forming)
    }
    pub fn active(&self) -> bool {
        matches!(self, Self::Active)
    }
}
