use crate::{
    constants::*,
    error::ErrorCode,
    events::MemberJoined,
    state::{Circle, CircleStatus, Config, Member},
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};
#[derive(Accounts)]
pub struct JoinCircle<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [CIRCLE_SEED, circle.creator.as_ref(), circle.circle_id.to_le_bytes().as_ref()], bump = circle.bump)]
    pub circle: Box<Account<'info, Circle>>,
    #[account(init, payer = wallet, space = 8 + 256, seeds = [MEMBER_SEED, circle.key().as_ref(), wallet.key().as_ref()], bump)]
    pub member: Box<Account<'info, Member>>,
    #[account(mut, constraint = source.mint == circle.mint @ ErrorCode::MintMismatch, constraint = source.owner == wallet.key() @ ErrorCode::TokenOwnerMismatch)]
    pub source: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [DEPOSIT_SEED, circle.key().as_ref()], bump, constraint = deposit_vault.mint == circle.mint @ ErrorCode::MintMismatch)]
    pub deposit_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = circle.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
pub fn process(ctx: Context<JoinCircle>, slot: u8) -> Result<()> {
    let c = &mut ctx.accounts.circle;
    require!(
        c.status == CircleStatus::Forming,
        ErrorCode::CircleNotForming
    );
    require!(slot < c.max_members, ErrorCode::InvalidSlot);
    let bit = 1u16
        .checked_shl(u32::from(slot))
        .ok_or(ErrorCode::MathOverflow)?;
    require!(c.slots_taken & bit == 0, ErrorCode::SlotTaken);
    let deposit = c
        .contribution
        .checked_mul(u64::from((c.max_members - 1 - slot).max(1)))
        .ok_or(ErrorCode::MathOverflow)?;
    let cp = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.source.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.deposit_vault.to_account_info(),
            authority: ctx.accounts.wallet.to_account_info(),
        },
    );
    anchor_spl::token_interface::transfer_checked(cp, deposit, ctx.accounts.mint.decimals)?;
    let m = &mut ctx.accounts.member;
    m.wallet = ctx.accounts.wallet.key();
    m.circle = c.key();
    m.slot = slot;
    m.deposit_total = deposit;
    m.deposit_remaining = deposit;
    m.paid_bitmask = 0;
    m.defaults = 0;
    m.received = false;
    m.deposit_withdrawn = false;
    m.score_recorded = false;
    m.paid_on_time = 0;
    m.contributed_total = 0;
    m.forfeit_claimed = false;
    m.bump = ctx.bumps.member;
    c.slots_taken |= bit;
    c.member_count = c
        .member_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    if c.member_count == c.max_members {
        c.status = CircleStatus::Active;
        c.eligible_members = c.max_members;
        c.round_start_ts = Clock::get()?.unix_timestamp;
    }
    emit!(MemberJoined {
        circle: c.key(),
        member: m.key(),
        wallet: m.wallet,
        slot,
        deposit
    });
    Ok(())
}
