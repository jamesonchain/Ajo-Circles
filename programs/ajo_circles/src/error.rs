use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The fee is outside the allowed range")]
    InvalidFee,
    #[msg("The minimum period must be positive")]
    InvalidMinimumPeriod,
    #[msg("The circle name is too long")]
    NameTooLong,
    #[msg("The contribution must be positive")]
    InvalidContribution,
    #[msg("The period is below the configured minimum")]
    PeriodTooShort,
    #[msg("The member count must be between 3 and 12")]
    InvalidMemberCount,
    #[msg("The selected slot is outside the circle")]
    InvalidSlot,
    #[msg("The selected slot is already taken")]
    SlotTaken,
    #[msg("The circle is not forming")]
    CircleNotForming,
    #[msg("The circle is not active")]
    CircleNotActive,
    #[msg("The member has already paid this round")]
    AlreadyPaid,
    #[msg("The round deadline has passed")]
    DeadlinePassed,
    #[msg("The account mint does not match the circle mint")]
    MintMismatch,
    #[msg("The token account is not owned by the expected wallet")]
    TokenOwnerMismatch,
    #[msg("The arithmetic operation would overflow")]
    MathOverflow,
}
