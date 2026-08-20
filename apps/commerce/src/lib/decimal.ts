const decimalPattern = /^-?\d+(?:\.\d+)?$/;

export class DecimalValue {
  private constructor(
    private readonly units: bigint,
    private readonly scale: number,
  ) {}

  static parse(value: string): DecimalValue {
    if (!decimalPattern.test(value))
      throw new Error(`Decimal inválido: ${value}`);
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [whole = "0", fraction = ""] = unsigned.split(".");
    const units = BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n);
    return new DecimalValue(units, fraction.length).normalized();
  }

  static zero(): DecimalValue {
    return new DecimalValue(0n, 0);
  }

  add(other: DecimalValue): DecimalValue {
    const scale = Math.max(this.scale, other.scale);
    return new DecimalValue(
      this.units * power10(scale - this.scale) +
        other.units * power10(scale - other.scale),
      scale,
    ).normalized();
  }

  subtract(other: DecimalValue): DecimalValue {
    return this.add(new DecimalValue(-other.units, other.scale));
  }

  multiply(other: DecimalValue): DecimalValue {
    return new DecimalValue(
      this.units * other.units,
      this.scale + other.scale,
    ).normalized();
  }

  divide(other: DecimalValue, precision = 12): DecimalValue {
    if (other.units === 0n) throw new Error("Divisão por zero");
    const numerator = this.units * power10(precision + other.scale);
    const denominator = other.units * power10(this.scale);
    return new DecimalValue(
      divideHalfUp(numerator, denominator),
      precision,
    ).normalized();
  }

  isNegative(): boolean {
    return this.units < 0n;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  isGreaterThanOrEqual(other: DecimalValue): boolean {
    const scale = Math.max(this.scale, other.scale);
    return (
      this.units * power10(scale - this.scale) >=
      other.units * power10(scale - other.scale)
    );
  }

  toFixed(scale: number): string {
    const difference = scale - this.scale;
    const rounded =
      difference >= 0
        ? this.units * power10(difference)
        : divideHalfUp(this.units, power10(-difference));
    const negative = rounded < 0n;
    const digits = (negative ? -rounded : rounded)
      .toString()
      .padStart(scale + 1, "0");
    if (scale === 0) return `${negative ? "-" : ""}${digits}`;
    return `${negative ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  }

  private normalized(): DecimalValue {
    let units = this.units;
    let scale = this.scale;
    while (scale > 0 && units % 10n === 0n) {
      units /= 10n;
      scale -= 1;
    }
    return new DecimalValue(units, scale);
  }
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  if (absoluteRemainder * 2n < absoluteDenominator) return quotient;
  const sameSign = numerator < 0n === denominator < 0n;
  return quotient + (sameSign ? 1n : -1n);
}

function power10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}
