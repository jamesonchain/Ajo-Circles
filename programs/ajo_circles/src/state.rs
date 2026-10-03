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
