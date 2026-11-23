/** Engineering drawing of a 10 x 70 precision pin. Lines draw in once (see login.css). */
export default function PinDrawing() {
  return (
    <svg
      className="sft-login__drawing"
      viewBox="0 0 520 220"
      role="img"
      aria-label="Technical drawing of a precision pin, 10 millimetre diameter by 70 millimetre length"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M20 110H500" strokeDasharray="14 3 2 3" strokeOpacity=".45" />
        <path className="sft-login__draw" pathLength={1} d="M60 72H96V148H60Z" />
        <path className="sft-login__draw" pathLength={1} d="M96 88H430L446 100V120L430 132H96" />
        <path className="sft-login__draw" pathLength={1} d="M356 88V132M364 88V132" strokeOpacity=".7" />
        <path className="sft-login__draw" pathLength={1} d="M400 103a7 7 0 1 0 .01 0" strokeOpacity=".7" />
        <g strokeOpacity=".6">
          <path className="sft-login__draw" pathLength={1} d="M96 132V190M446 120V190M96 182H446M96 176V188M446 176V188" />
          <path className="sft-login__draw" pathLength={1} d="M446 88H486M446 132H486M478 88V132M473 88H483M473 132H483" />
        </g>
      </g>
      <g fontFamily="'Geist Variable', sans-serif" fontSize="12" fill="currentColor" letterSpacing=".08em">
        <text x="271" y="174" textAnchor="middle">70</text>
        <text x="492" y="114">Ø10</text>
      </g>
    </svg>
  );
}
