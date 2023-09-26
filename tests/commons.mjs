import { disabledLogger } from '@incubateur-ademe/publicodes-tools'
import Engine from 'publicodes'

function col(str, color) {
	return color + str + '\x1b[0m'
}

const c = {
	orange: (str) => col(str, '\x1b[33m'),
	red: (str) => col(str, '\x1b[31m'),
	green: (str) => col(str, '\x1b[32m'),
	white: (str) => col(str, '\x1b[37m'),
	gray: (str) => col(str, '\x1b[90m'),
	yellow: (str) => col(str, '\x1b[93m'),
	dim: (str) => col(str, '\x1b[2m'),
}

const kgCO2Str = c.dim('(kg CO2e)')

function formatValueInKgCO2e(value) {
	return c.yellow(Math.round(value).toLocaleString('en-us')) + ' ' + kgCO2Str
}

function fmtCLIErr(localResult, prodResult, diff, diffPercent, name, color) {
	const sign = diff > 0 ? '+' : ''
	const hd = color(diffPercent < 1 ? '[WARN]' : '[FAIL]')
	return `${hd} ${name} [${color(sign + diff)} ${kgCO2Str}, ${color(
		sign + diffPercent
	)}%]: ${formatValueInKgCO2e(localResult)} != ${formatValueInKgCO2e(
		prodResult
	)}`
}

function fmtGHActionErr(localResult, prodResult, diff, diffPercent, name) {
	const color =
		diffPercent <= 1 ? 'sucess' : diffPercent > 5 ? 'critical' : 'important'
	const sign = diff > 0 ? '%2B' : '-'
	return `|![](https://img.shields.io/badge/${name.replaceAll(
		' ',
		'%20'
	)}-${sign}${Math.round(diff).toLocaleString(
		'en-us'
	)}%20kgCO2e-${color}?style=flat-square) | **${localResult.toLocaleString(
		'en-us'
	)}** | ${prodResult.toLocaleString('en-us')} | ${
		diff > 0 ? '+' : ''
	}${diffPercent}% |`
}

// TODO: could be improved by using a more generic way to compare results.
export function printResults(
	localResults,
	prodResults,
	markdown,
	withOptim = false
) {
	if (markdown) {
		console.log(
			`#### ${
				withOptim ? 'Test model optimisation' : 'Test personas regression'
			}`
		)
		console.log(
			`| Persona | Total PR ${
				withOptim ? 'with optim.' : ''
			} (kg CO2e) | Total ${
				withOptim ? 'PR without optim.' : 'in prod.'
			} (kg CO2e) | Δ (%) |`
		)
		console.log('|-----:|:------:|:------:|:----:|')
	} else {
		console.log(
			`${
				withOptim
					? c.white('====== With optimisation ======')
					: c.white('====== Base model ======')
			}`
		)
	}
	for (let name in localResults) {
		if (localResults[name] !== prodResults[name]) {
			const localResult = Math.round(localResults[name])
			const prodResult = Math.round(prodResults[name])
			const diff = localResult - prodResult
			const diffPercent = Math.round((diff / prodResult) * 100)
			const color = diffPercent <= 1 ? 'orange' : 'red'

			console.log(
				markdown
					? fmtGHActionErr(
							localResult,
							prodResult,
							diff,
							diffPercent,
							name,
							color
					  )
					: fmtCLIErr(
							localResult,
							prodResult,
							diff,
							diffPercent,
							name,
							c[color]
					  )
			)
		} else if (!markdown) {
			console.log(
				`${c.green('[PASS]')} ${name}: ${formatValueInKgCO2e(
					localResults[name]
				)}`
			)
		}
	}
}

export function testPersonas(rules, personas) {
	const engine = new Engine(rules, { logger: disabledLogger })
	const modelRules = Object.keys(engine.getParsedRules())
	const personasRules = Object.values(personas)
	const results = {}

	for (let persona of personasRules) {
		const personaData = persona.situation || {}
		const validPersonaRules = Object.fromEntries(
			Object.entries(personaData).filter(([ruleName, _]) =>
				modelRules.includes(ruleName)
			)
		)

		engine.setSituation(validPersonaRules)
		results[persona.nom] = engine.evaluate('bilan').nodeValue
	}

	return results
}