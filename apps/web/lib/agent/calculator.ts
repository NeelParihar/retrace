export class CalcError extends Error {}

const NUMBER = /^(\d+(\.\d+)?|\.\d+)([eE][-+]?\d+)?/;

/** Small recursive-descent arithmetic parser: + - * / ^ ( ), unary minus. Never uses eval. */
export function evaluate(expression: string): number {
  const src = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/(\d),(?=\d{3})/g, "$1");
  let pos = 0;

  const skip = () => {
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  };
  const unexpected = () => new CalcError(`unexpected token at ${pos}: '${src[pos] ?? "end of input"}'`);

  function expr(): number {
    let v = term();
    for (;;) {
      skip();
      if (src[pos] === "+") {
        pos++;
        v += term();
      } else if (src[pos] === "-") {
        pos++;
        v -= term();
      } else return v;
    }
  }
  function term(): number {
    let v = power();
    for (;;) {
      skip();
      if (src[pos] === "*") {
        pos++;
        v *= power();
      } else if (src[pos] === "/") {
        pos++;
        const d = power();
        if (d === 0) throw new CalcError("division by zero");
        v /= d;
      } else return v;
    }
  }
  function power(): number {
    const base = unary();
    skip();
    if (src[pos] === "^") {
      pos++;
      return Math.pow(base, power());
    }
    return base;
  }
  function unary(): number {
    skip();
    if (src[pos] === "-") {
      pos++;
      return -unary();
    }
    if (src[pos] === "+") {
      pos++;
      return unary();
    }
    return primary();
  }
  function primary(): number {
    skip();
    if (src[pos] === "(") {
      pos++;
      const v = expr();
      skip();
      if (src[pos] !== ")") throw unexpected();
      pos++;
      return v;
    }
    const m = NUMBER.exec(src.slice(pos));
    if (!m) throw unexpected();
    pos += m[0].length;
    return parseFloat(m[0]);
  }

  const v = expr();
  skip();
  if (pos < src.length) throw unexpected();
  if (!Number.isFinite(v)) throw new CalcError("result is not finite");
  return v;
}

export function formatNumber(v: number): string {
  return Number(v.toPrecision(12)).toString();
}
