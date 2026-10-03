type Member = { name: string; state: "paid" | "next" | "waiting" };

const members: Member[] = [
  { name: "Ada", state: "paid" },
  { name: "Tunde", state: "paid" },
  { name: "Mina", state: "next" },
  { name: "Chidi", state: "waiting" },
  { name: "Zainab", state: "waiting" },
];

export function CircleRing() {
  return (
    <div
      className="ring-wrap"
      aria-label="Five member circle. Mina receives the next pot. Three members have paid this round."
    >
      <svg
        className="ring-lines"
        viewBox="0 0 500 500"
        role="img"
        aria-hidden="true"
      >
        <circle cx="250" cy="250" r="171" className="ring-track" />
        <circle cx="250" cy="250" r="171" className="ring-progress" />
      </svg>
      <div className="pot-core">
        <span className="eyebrow">Next pot</span>
        <strong>$48.75</strong>
        <span className="muted">Mina receives it</span>
      </div>
      {members.map((member, index) => {
        const angle = index * 72 - 90;
        const x = 50 + 39 * Math.cos((angle * Math.PI) / 180);
        const y = 50 + 39 * Math.sin((angle * Math.PI) / 180);
        return (
          <div
            className={`avatar avatar-${member.state}`}
            key={member.name}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span>{member.name.slice(0, 1)}</span>
            <small>{member.name}</small>
          </div>
        );
      })}
    </div>
  );
}
