import type { CircleMembership } from "ajo_circles_sdk";

type RingMember = {
  wallet: string;
  slot: number;
  paid: boolean;
  missed: boolean;
};

type CircleRingProps = {
  circle: CircleMembership["circle"] | null;
  members: RingMember[];
  potAmount: bigint;
};

function formatUsdc(amount: bigint) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) / 1_000_000);
}

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 3)}...${wallet.slice(-3)}`;
}

export function CircleRing({ circle, members, potAmount }: CircleRingProps) {
  const count = circle?.maxMembers ?? 5;
  const currentRound = circle?.currentRound ?? 0;
  const turn = members.find((member) => member.slot === currentRound);
  const paidCount = members.filter((member) => member.paid).length;
  const occupiedSlots = new Set(members.map((member) => member.slot));
  const openSlots = circle
    ? Array.from({ length: count }, (_, slot) => slot).filter(
        (slot) => !occupiedSlots.has(slot)
      )
    : [];
  const accessibleSummary = circle
    ? `${circle.name}. ${members.length} of ${
        circle.maxMembers
      } members joined. ${paidCount} have paid this round. ${
        turn
          ? `${shortWallet(turn.wallet)} receives the next pot.`
          : "No recipient is available yet."
      }`
    : "No circle selected. The circle ring will show member turns and payments after you select a circle.";

  return (
    <div className="ring-wrap" role="img" aria-label={accessibleSummary}>
      <svg
        className="ring-lines"
        viewBox="0 0 500 500"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="250" cy="250" r="171" className="ring-track" />
        <circle
          cx="250"
          cy="250"
          r="171"
          className="ring-progress"
          style={{
            strokeDasharray: `${circle ? (paidCount / count) * 815 : 0} 1075`,
          }}
        />
      </svg>
      <div className="pot-core">
        <span className="eyebrow">{circle ? "Circle pot" : "Your circle"}</span>
        <strong>{formatUsdc(potAmount)}</strong>
        <span className="muted">
          {circle && turn
            ? `${shortWallet(turn.wallet)} receives it`
            : "Live circle balance"}
        </span>
      </div>
      {members.map((member) => {
        const angle = (member.slot / count) * 360 - 90;
        const x = 50 + 39 * Math.cos((angle * Math.PI) / 180);
        const y = 50 + 39 * Math.sin((angle * Math.PI) / 180);
        const state = member.missed
          ? "missed"
          : member.slot === currentRound
          ? "next"
          : member.paid
          ? "paid"
          : "waiting";
        return (
          <div
            className={`avatar avatar-${state}`}
            key={member.wallet}
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`${shortWallet(member.wallet)}, ${state}`}
          >
            <span>{member.wallet.slice(0, 1).toUpperCase()}</span>
            <small>{shortWallet(member.wallet)}</small>
          </div>
        );
      })}
      {circle &&
        openSlots.map((slot) => {
            const angle = (slot / count) * 360 - 90;
            const x = 50 + 39 * Math.cos((angle * Math.PI) / 180);
            const y = 50 + 39 * Math.sin((angle * Math.PI) / 180);
            return (
              <div
                className="avatar avatar-open"
                key={`open-${slot}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={`Slot ${slot + 1} is open`}
              >
                <span>+</span>
                <small>Open</small>
              </div>
            );
          })}
    </div>
  );
}
