"use client";

import { useState } from "react";
import { CircleRing } from "./components/circle-ring";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState("");
  const connect = () => {
    setConnected(true);
    setToast("Wallet connected for this demo");
    window.setTimeout(() => setToast(""), 2800);
  };
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">A</span>
          <span>Ajo Circles</span>
        </a>
        <nav className="nav" aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#circles">My circles</a>
          <a href="#score">Ajo Score</a>
          <button className="button button-primary" onClick={connect}>
            {connected ? "Connected" : "Connect wallet"}
          </button>
        </nav>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Save together, safely</span>
          <h1>Your people. Your pot. Your turn.</h1>
          <p>
            Ajo Circles brings the savings circle you already trust onto Solana,
            with clear turns, protected payments and a track record you own.
          </p>
          <div className="hero-actions">
            <button className="button button-gold" onClick={connect}>
              Start a circle
            </button>
            <a className="text-link" href="#how">
              See how it works <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-note">
            <span className="pulse" aria-hidden="true" /> Live on Solana devnet,
            built for everyday saving
          </div>
        </div>
        <div className="hero-art">
          <CircleRing />
        </div>
      </section>
      <section className="stats" aria-label="Ajo Circles live stats">
        <div className="stats-inner">
          <div className="stat">
            <strong>128</strong>
            <span>circles created</span>
          </div>
          <div className="stat">
            <strong>$42.8k</strong>
            <span>saved together</span>
          </div>
          <div className="stat">
            <strong>684</strong>
            <span>payouts made</span>
          </div>
          <div className="stat">
            <strong>31</strong>
            <span>payments covered</span>
          </div>
        </div>
      </section>
      <section className="section" id="how">
        <div className="section-head">
          <div>
            <span className="eyebrow">A better way to save</span>
            <h2>The trust is in the rules.</h2>
          </div>
          <p>
            Everyone knows what they put in, when they get paid and how the
            circle handles a missed payment. The contract keeps the record.
          </p>
        </div>
        <div className="steps">
          <article className="step-card">
            <span className="step-number">01</span>
            <h3>Pick your turn</h3>
            <p>
              Choose when you want to receive the pot. Earlier turns have a
              larger deposit, because they carry more risk.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">02</span>
            <h3>Pay your share</h3>
            <p>
              Make one clear payment each round. Everyone can see the circle
              move forward without seeing private wallet details.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <h3>Get your future back</h3>
            <p>
              When the circle ends, unused deposits return to their owners and
              your Ajo Score records the journey.
            </p>
          </article>
        </div>
      </section>
      <section className="dashboard" id="circles">
        <div className="dashboard-grid">
          <div>
            <span className="eyebrow">Your progress</span>
            <h2>Small steps make a strong record.</h2>
            <p className="hero-copy">
              <span>
                See every circle, every turn and every payment in one calm
                place.
              </span>
            </p>
            <button className="button button-primary" onClick={connect}>
              View my circles
            </button>
          </div>
          <div className="circle-list">
            <div className="score-card" id="score">
              <div className="score-top">
                <div>
                  <span className="eyebrow">Your Ajo Score</span>
                  <p>Onchain savings history</p>
                </div>
                <div className="score-number">742</div>
              </div>
              <div className="score-line">
                <span />
              </div>
              <p>
                3 circles completed, 28 payments made on time and no missed
                turns.
              </p>
            </div>
            <article className="circle-card">
              <div>
                <h3>Sunday Supper Club</h3>
                <p>Round 3 of 5, your payment is due today</p>
              </div>
              <div className="circle-amount">
                $10.00<small>Pay now</small>
              </div>
            </article>
            <article className="circle-card">
              <div>
                <h3>Market Women United</h3>
                <p>Completed, deposit ready to withdraw</p>
              </div>
              <div className="circle-amount">
                $40.00<small>Withdraw</small>
              </div>
            </article>
          </div>
        </div>
      </section>
      <footer className="footer">
        <span>© 2026 Ajo Circles</span>
        <span>Built for communities that save together</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
