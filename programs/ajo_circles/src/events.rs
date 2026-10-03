use anchor_lang::prelude::*;
#[event]
pub struct CircleCreated {
    pub circle: Pubkey,
    pub creator: Pubkey,
    pub circle_id: u64,
    pub contribution: u64,
    pub max_members: u8,
}
#[event]
pub struct MemberJoined {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub wallet: Pubkey,
    pub slot: u8,
    pub deposit: u64,
}
#[event]
pub struct Contributed {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub round: u8,
    pub amount: u64,
}
#[event]
pub struct CircleCancelled {
    pub circle: Pubkey,
    pub creator: Pubkey,
}
#[event]
pub struct DepositRefunded {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub amount: u64,
}
#[event]
pub struct DefaultSettled {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub round: u8,
    pub covered: u64,
    pub shortfall: u64,
}
#[event]
pub struct PayoutClaimed {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub round: u8,
    pub amount: u64,
    pub fee: u64,
}
#[event]
pub struct PayoutForfeited {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub round: u8,
    pub amount: u64,
}
#[event]
pub struct CircleCompleted {
    pub circle: Pubkey,
    pub total_paid_out: u64,
    pub forfeit_pool: u64,
}
#[event]
pub struct DepositWithdrawn {
    pub circle: Pubkey,
    pub member: Pubkey,
    pub amount: u64,
}
#[event]
pub struct ScoreUpdated {
    pub wallet: Pubkey,
    pub circles_completed: u32,
    pub rounds_paid_on_time: u64,
    pub rounds_defaulted: u64,
}
