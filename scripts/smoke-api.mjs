const baseUrl =
  process.env.SMOKE_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://127.0.0.1:3000';

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, received: ${text.slice(0, 200)}`);
  }
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(`/api/health returned ${response.status}`);
  }

  if (body.status !== 'ok' || body.service !== 'debtdetox') {
    throw new Error(`/api/health returned unexpected body: ${JSON.stringify(body)}`);
  }
}

async function checkInlineInvestmentProjection() {
  const response = await fetch(`${baseUrl}/api/investments/project`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      investment: {
        initial_balance_cents: 100000,
        monthly_contribution_cents: 10000,
        annual_return_bps: 700,
        tax_status: 'taxable',
        tax_rate_bps: 2500,
        inflation_rate_bps: 300,
      },
      years: 1,
      include_inflation: true,
      include_taxes: true,
    }),
  });
  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(`/api/investments/project returned ${response.status}: ${JSON.stringify(body)}`);
  }

  if (!Array.isArray(body.schedule) || body.schedule.length !== 12) {
    throw new Error('Investment projection smoke check expected a 12-month schedule');
  }

  if (typeof body.final_balance_cents !== 'number' || body.final_balance_cents <= 100000) {
    throw new Error('Investment projection smoke check expected growth above the initial balance');
  }

  if (typeof body.total_interest_cents !== 'number' || body.total_interest_cents <= 0) {
    throw new Error('Investment projection smoke check expected positive investment growth');
  }
}

async function main() {
  await checkHealth();
  await checkInlineInvestmentProjection();
  console.log(`API smoke checks passed against ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
