import React, { useMemo, useState } from "react";

const PAY_PERIODS = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

const ONTARIO_2026 = {
  minimumWage: 17.6,
  overtimeThresholdWeeklyHours: 44,
  overtimeMultiplier: 1.5,
  vacationUnder5Years: 0.04,
  vacation5PlusYears: 0.06,
  cpp: {
    basicExemptionAnnual: 3500,
    ympe: 74600,
    rate: 0.0595,
    max: 4230.45,
    cpp2Threshold: 74600,
    aympe: 85000,
    cpp2Rate: 0.04,
    cpp2Max: 416.0,
  },
  ei: {
    rate: 0.0163,
    maxInsurable: 68900,
    max: 1123.07,
  },
  federal: {
    basicPersonalAmount: 16129,
    canadaEmploymentAmount: 1496,
    lowestRateCredit: 0.14,
    brackets: [
      { upTo: 58523, rate: 0.14 },
      { upTo: 117045, rate: 0.205 },
      { upTo: 181440, rate: 0.26 },
      { upTo: 258482, rate: 0.29 },
      { upTo: Infinity, rate: 0.33 },
    ],
  },
  ontarioTax: {
    basicPersonalAmount: 12989,
    lowestRateCredit: 0.0505,
    brackets: [
      { upTo: 53891, rate: 0.0505 },
      { upTo: 107785, rate: 0.0915 },
      { upTo: 150000, rate: 0.1116 },
      { upTo: 220000, rate: 0.1216 },
      { upTo: Infinity, rate: 0.1316 },
    ],
  },
};

function currency(n) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number.isFinite(n) ? n : 0);
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function progressiveTax(income, brackets) {
  if (income <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo;
    const taxableAtThisRate = Math.max(0, Math.min(income, upper) - lower);
    tax += taxableAtThisRate * bracket.rate;
    lower = upper;
    if (income <= upper) break;
  }
  return tax;
}

function calcOntarioHealthPremium(annualIncome) {
  const A = annualIncome;
  if (A <= 20000) return 0;
  if (A <= 25000) return Math.min(300, 0.06 * (A - 20000));
  if (A <= 36000) return 300;
  if (A <= 38500) return Math.min(450, 300 + 0.06 * (A - 36000));
  if (A <= 48000) return 450;
  if (A <= 48600) return Math.min(600, 450 + 0.25 * (A - 48000));
  if (A <= 72000) return 600;
  if (A <= 72600) return Math.min(750, 600 + 0.25 * (A - 72000));
  if (A <= 200000) return 750;
  if (A <= 200600) return Math.min(900, 750 + 0.25 * (A - 200000));
  return 900;
}

function calcAnnualTaxes(annualTaxableIncome, annualCppBase, annualCpp2, annualEi) {
  const fedBase = progressiveTax(annualTaxableIncome, ONTARIO_2026.federal.brackets);
  const fedCredits =
    (ONTARIO_2026.federal.basicPersonalAmount + ONTARIO_2026.federal.canadaEmploymentAmount) *
      ONTARIO_2026.federal.lowestRateCredit +
    annualCppBase * ONTARIO_2026.federal.lowestRateCredit +
    annualCpp2 * ONTARIO_2026.federal.lowestRateCredit +
    annualEi * ONTARIO_2026.federal.lowestRateCredit;
  const federalTax = Math.max(0, fedBase - fedCredits);

  const onBase = progressiveTax(annualTaxableIncome, ONTARIO_2026.ontarioTax.brackets);
  const onCredits =
    ONTARIO_2026.ontarioTax.basicPersonalAmount * ONTARIO_2026.ontarioTax.lowestRateCredit +
    annualCppBase * ONTARIO_2026.ontarioTax.lowestRateCredit +
    annualCpp2 * ONTARIO_2026.ontarioTax.lowestRateCredit +
    annualEi * ONTARIO_2026.ontarioTax.lowestRateCredit;
  const ontarioIncomeTax = Math.max(0, onBase - onCredits);
  const ontarioHealthPremium = calcOntarioHealthPremium(annualTaxableIncome);

  return {
    federalTax: round2(federalTax),
    ontarioIncomeTax: round2(ontarioIncomeTax),
    ontarioHealthPremium: round2(ontarioHealthPremium),
    totalTax: round2(federalTax + ontarioIncomeTax + ontarioHealthPremium),
  };
}

export default function App() {
  const [payFrequency, setPayFrequency] = useState("biweekly");
  const [employeeType, setEmployeeType] = useState("hourly");
  const [hourlyRate, setHourlyRate] = useState("20");
  const [hoursWorked, setHoursWorked] = useState("40");
  const [salaryPerPeriod, setSalaryPerPeriod] = useState("3000");
  const [yearsWorked, setYearsWorked] = useState("0");
  const [includeVacationEachCheque, setIncludeVacationEachCheque] = useState("yes");
  const [bonusThisPeriod, setBonusThisPeriod] = useState("0");

  const result = useMemo(() => {
    const periods = PAY_PERIODS[payFrequency];
    const rate = Number(hourlyRate) || 0;
    const hours = Number(hoursWorked) || 0;
    const salary = Number(salaryPerPeriod) || 0;
    const years = Number(yearsWorked) || 0;
    const bonus = Number(bonusThisPeriod) || 0;

    const vacationRate =
      years >= 5 ? ONTARIO_2026.vacation5PlusYears : ONTARIO_2026.vacationUnder5Years;

    let regularPay = 0;
    let overtimePay = 0;

    if (employeeType === "hourly") {
      if (payFrequency === "weekly") {
        const regularHours = Math.min(hours, ONTARIO_2026.overtimeThresholdWeeklyHours);
        const overtimeHours = Math.max(0, hours - ONTARIO_2026.overtimeThresholdWeeklyHours);
        regularPay = regularHours * rate;
        overtimePay = overtimeHours * rate * ONTARIO_2026.overtimeMultiplier;
      } else {
        const weeklyHours =
          hours / (periods === 26 ? 2 : periods === 24 ? 52 / 24 : periods === 12 ? 52 / 12 : 1);
        const weeklyRegular = Math.min(weeklyHours, ONTARIO_2026.overtimeThresholdWeeklyHours);
        const weeklyOT = Math.max(0, weeklyHours - ONTARIO_2026.overtimeThresholdWeeklyHours);
        const multiplier =
          payFrequency === "biweekly"
            ? 2
            : payFrequency === "semimonthly"
            ? 52 / 24
            : payFrequency === "monthly"
            ? 52 / 12
            : 1;
        regularPay = weeklyRegular * rate * multiplier;
        overtimePay = weeklyOT * rate * ONTARIO_2026.overtimeMultiplier * multiplier;
      }
    } else {
      regularPay = salary;
    }

    const grossBeforeVacation = regularPay + overtimePay + bonus;
    const vacationPay = includeVacationEachCheque === "yes" ? grossBeforeVacation * vacationRate : 0;
    const grossPay = grossBeforeVacation + vacationPay;
    const annualGross = grossPay * periods;

    const annualCppBaseEarnings = Math.max(
      0,
      Math.min(annualGross, ONTARIO_2026.cpp.ympe) - ONTARIO_2026.cpp.basicExemptionAnnual
    );
    const annualCppBase = Math.min(
      annualCppBaseEarnings * ONTARIO_2026.cpp.rate,
      ONTARIO_2026.cpp.max
    );

    const annualCpp2Earnings = Math.max(
      0,
      Math.min(annualGross, ONTARIO_2026.cpp.aympe) - ONTARIO_2026.cpp.cpp2Threshold
    );
    const annualCpp2 = Math.min(
      annualCpp2Earnings * ONTARIO_2026.cpp.cpp2Rate,
      ONTARIO_2026.cpp.cpp2Max
    );

    const annualEiEarnings = Math.min(annualGross, ONTARIO_2026.ei.maxInsurable);
    const annualEi = Math.min(annualEiEarnings * ONTARIO_2026.ei.rate, ONTARIO_2026.ei.max);

    const annualTaxes = calcAnnualTaxes(annualGross, annualCppBase, annualCpp2, annualEi);

    const cppPerPeriod = annualCppBase / periods;
    const cpp2PerPeriod = annualCpp2 / periods;
    const eiPerPeriod = annualEi / periods;
    const taxPerPeriod = annualTaxes.totalTax / periods;
    const netPay = grossPay - cppPerPeriod - cpp2PerPeriod - eiPerPeriod - taxPerPeriod;

    return {
      vacationRate,
      regularPay: round2(regularPay),
      overtimePay: round2(overtimePay),
      bonus: round2(bonus),
      vacationPay: round2(vacationPay),
      grossPay: round2(grossPay),
      cppPerPeriod: round2(cppPerPeriod),
      cpp2PerPeriod: round2(cpp2PerPeriod),
      eiPerPeriod: round2(eiPerPeriod),
      taxPerPeriod: round2(taxPerPeriod),
      netPay: round2(netPay),
      annualGross: round2(annualGross),
      annualTax: annualTaxes,
      minWageWarning: employeeType === "hourly" && rate < ONTARIO_2026.minimumWage,
    };
  }, [
    payFrequency,
    employeeType,
    hourlyRate,
    hoursWorked,
    salaryPerPeriod,
    yearsWorked,
    includeVacationEachCheque,
    bonusThisPeriod,
  ]);

  return (
    <div className="page">
      <div className="container">
        <header className="hero">
          <div>
            <p className="eyebrow">Ontario · 2026</p>
            <h1>Ontario Payroll Calculator</h1>
            <p className="subtext">
              A simple, shareable payroll estimator for hourly and salaried employees.
            </p>
          </div>
          <div className="pill">Built for Vercel</div>
        </header>

        <section className="notice">
          <strong>Important:</strong> This is an educational and pre-payroll estimator. For real payroll
          runs, compare results with CRA PDOC and your payroll provider.
        </section>

        <div className="grid two">
          <div className="card">
            <h2>Inputs</h2>

            <div className="field-grid">
              <label>
                <span>Pay frequency</span>
                <select value={payFrequency} onChange={(e) => setPayFrequency(e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semimonthly">Semi-monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>

              <label>
                <span>Employee type</span>
                <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)}>
                  <option value="hourly">Hourly</option>
                  <option value="salary">Salary</option>
                </select>
              </label>
            </div>

            {employeeType === "hourly" ? (
              <div className="field-grid">
                <label>
                  <span>Hourly rate</span>
                  <input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
                </label>

                <label>
                  <span>Hours in this pay period</span>
                  <input value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} />
                </label>
              </div>
            ) : (
              <label>
                <span>Salary for this pay period</span>
                <input value={salaryPerPeriod} onChange={(e) => setSalaryPerPeriod(e.target.value)} />
              </label>
            )}

            <div className="field-grid three">
              <label>
                <span>Years with employer</span>
                <input value={yearsWorked} onChange={(e) => setYearsWorked(e.target.value)} />
              </label>

              <label>
                <span>Vacation on each cheque?</span>
                <select
                  value={includeVacationEachCheque}
                  onChange={(e) => setIncludeVacationEachCheque(e.target.value)}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>

              <label>
                <span>Bonus this period</span>
                <input value={bonusThisPeriod} onChange={(e) => setBonusThisPeriod(e.target.value)} />
              </label>
            </div>

            {result.minWageWarning && (
              <div className="warning">
                The hourly rate entered is below the Ontario general minimum wage of{" "}
                {currency(ONTARIO_2026.minimumWage)} per hour.
              </div>
            )}
          </div>

          <div className="card">
            <h2>Pay summary</h2>

            <div className="rows">
              <div className="row"><span>Regular pay</span><strong>{currency(result.regularPay)}</strong></div>
              <div className="row"><span>Overtime pay</span><strong>{currency(result.overtimePay)}</strong></div>
              <div className="row"><span>Bonus</span><strong>{currency(result.bonus)}</strong></div>
              <div className="row"><span>Vacation pay ({(result.vacationRate * 100).toFixed(0)}%)</span><strong>{currency(result.vacationPay)}</strong></div>
              <hr />
              <div className="row total"><span>Gross pay</span><strong>{currency(result.grossPay)}</strong></div>
              <hr />
              <div className="row"><span>CPP</span><strong>-{currency(result.cppPerPeriod)}</strong></div>
              <div className="row"><span>CPP2</span><strong>-{currency(result.cpp2PerPeriod)}</strong></div>
              <div className="row"><span>EI</span><strong>-{currency(result.eiPerPeriod)}</strong></div>
              <div className="row"><span>Income tax + OHP</span><strong>-{currency(result.taxPerPeriod)}</strong></div>
              <hr />
              <div className="row net"><span>Estimated net pay</span><strong>{currency(result.netPay)}</strong></div>
            </div>
          </div>
        </div>

        <div className="grid two">
          <div className="card">
            <h2>Annualized check</h2>
            <div className="stats">
              <div className="stat"><span>Annual gross</span><strong>{currency(result.annualGross)}</strong></div>
              <div className="stat"><span>Federal tax</span><strong>{currency(result.annualTax.federalTax)}</strong></div>
              <div className="stat"><span>Ontario tax</span><strong>{currency(result.annualTax.ontarioIncomeTax)}</strong></div>
              <div className="stat"><span>Ontario health premium</span><strong>{currency(result.annualTax.ontarioHealthPremium)}</strong></div>
            </div>
          </div>

          <div className="card">
            <h2>Next upgrades</h2>
            <ul className="clean-list">
              <li>TD1 claim amounts</li>
              <li>Year-to-date deductions</li>
              <li>Public holiday pay</li>
              <li>PDF payslip export</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
