export function Notes() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-foreground/85">
      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">What this is</h3>
        <p>
          A matching engine is the exchange. This is the other side of the wall: you are a
          large child order, the book has finite depth, and every share you sell leaves a{" "}
          <em className="font-display text-base text-foreground">wake</em> in the mid. The
          object of study is that wake — the impact kernel — and the stochastic-control
          problem of walking through it.
        </p>
        <p>
          It is intentionally orthogonal to a C++ L3 matcher. A matcher answers{" "}
          <em>how the book processes messages</em>. WAKE answers{" "}
          <em>what your own flow does to the price you will later trade</em>. WorldQuant-style
          alphas answer a third question:{" "}
          <em>what is predictable in the cross-section if you ignore your size</em>. A desk
          that cannot separate those three is not a desk.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">The kernel</h3>
        <p className="font-display text-lg italic text-paper">
          ΔS<sub>t</sub> = ∫ G(t − s) dε<sub>s</sub> + σ dW<sub>t</sub>
        </p>
        <p>
          G is the propagator. Empirically it is concave and slowly decaying, not a linear
          instantaneous hit. The square-root law
        </p>
        <p className="font-display text-lg italic text-paper">
          I(Q) ≃ Y σ √(Q / V<sub>d</sub>)
        </p>
        <p>
          is the one-number summary a trader actually uses (Y in 0.5–1, σ the daily vol, V
          <sub>d</sub> ADV). Linear Almgren–Chriss cannot generate a square root — that is
          not a bug in the demo, it is the misspecification experiment.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <span className="text-foreground">Linear AC</span> — temporary ηv plus permanent
            γ, closed form, mean-variance.
          </li>
          <li>
            <span className="text-foreground">Exponential</span> — Obizhaeva–Wang resilience
            ρ. Optimal: two blocks plus a flat interior.
          </li>
          <li>
            <span className="text-foreground">Power-law</span> — G(t) ∝ (t + t<sub>0</sub>
            )<sup>−β</sup>, β ≈ 0.4–0.5, the Bouchaud–Farmer–Lillo shape.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">Almgren–Chriss</h3>
        <p>
          Sell Q over [0, T], temporary cost ηv, arithmetic Brownian mid, mean-variance
          objective E[IS] + λ Var[IS]. The remaining inventory is
        </p>
        <p className="font-display text-lg italic text-paper">
          x(t) = Q sinh(κ(T − t)) / sinh(κT),&nbsp;&nbsp; κ = √(λ σ² / η)
        </p>
        <p>
          κT → 0 recovers TWAP. κT ≫ 1 dumps immediately: risk dominates impact. Urgency in
          this UI is κT, not a raw λ — traders do not think in Lagrange multipliers.
        </p>
        <p>
          Closed forms used for the linear-kernel analytics (and the unit tests):
        </p>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          ∫ v² dt = Q² κ (sinh(κT)cosh(κT) + κT) / (2 sinh²(κT))
          <br />
          ∫ x² dt = Q² (sinh(κT)cosh(κT) − κT) / (2κ sinh²(κT))
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">Obizhaeva–Wang</h3>
        <p>
          Exponential resilience, risk-neutral cost. Equal opening and closing blocks of
          size a = Q / (2 + ρT), continuous rate aρ in between so the depleted depth stays
          constant. Interior remaining x(t) = a (1 + ρ(T − t)). This is the right intuition
          when the book refills and you should wait for it — the opposite of “just TWAP.”
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">Misspecification</h3>
        <p>
          The interesting number is not “AC Sharpe.” It is: the world is a power-law
          propagator, you optimized as if it were linear AC, and you eat the extra
          implementation shortfall versus a kernel-optimal schedule. That gap is the cost of
          being wrong. A research resume that never shows a misspecification test is a
          backtest.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">What an interviewer will ask</h3>
        <ul className="list-disc space-y-2 pl-5">
          <li>Why is impact concave? What fails if you assume linear and the true kernel is square-root?</li>
          <li>Gatheral’s no-dynamic-arbitrage: which propagators admit round-trip profit?</li>
          <li>Permanent vs transient: what is still in the price tomorrow?</li>
          <li>How does Kyle’s λ relate to the propagator? When should you slow down?</li>
          <li>AC vs OW: when is front-loading optimal, when is a block-and-wait optimal?</li>
          <li>How would you estimate G(t) from public trades + mid without leaking future information?</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">Papers</h3>
        <ul className="space-y-1.5 text-muted-foreground">
          <li>Almgren & Chriss (2000/2001), Optimal execution of portfolio transactions.</li>
          <li>Obizhaeva & Wang (2013), Optimal trading as a liquidity-supplier’s problem.</li>
          <li>Gatheral (2010), No-dynamic-arbitrage and market impact.</li>
          <li>Bouchaud, Farmer, Lillo — How markets slowly digest changes in supply and demand.</li>
          <li>Toth et al. (2011), Anomalous price impact and the critical nature of liquidity.</li>
          <li>Kyle (1985), Continuous auctions and insider trading.</li>
          <li>Bucci, Benzaquen, Lillo, Bouchaud — Slow decay of impact, square-root law.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-2xl italic text-foreground">Putting it on a CV</h3>
        <p className="rounded-lg bg-secondary/70 p-4 font-mono text-xs leading-relaxed text-foreground/90 shadow-border">
          WAKE — market-impact laboratory. Calibrated square-root and power-law propagator
          kernels; derived Almgren–Chriss and Obizhaeva–Wang schedules; projected-gradient
          kernel-optimal execution; Monte Carlo implementation-shortfall vs closed form;
          quantified extra shortfall from kernel misspecification.
        </p>
        <p className="text-muted-foreground">
          One project. Numbers you can derive on a whiteboard. Do not list “used React.”
        </p>
      </section>
    </article>
  );
}
