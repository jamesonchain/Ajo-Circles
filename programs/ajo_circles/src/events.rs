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
