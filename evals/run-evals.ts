/**
 * Script to run agent evaluations
 * Usage: npx tsx evals/run-evals.ts [suite-name]
 */

import { runEvalSuite, evalSuites, generateEvalReport, type EvalResult } from './agent-evals'
import { writeFile } from 'fs/promises'
import { join } from 'path'

async function main() {
  const suiteName = process.argv[2] || 'all'
  const outputDir = join(process.cwd(), 'evals', 'results')

  const suites = {
    basic: evalSuites.basicToolCalls(),
    toolUseId: evalSuites.toolUseIdMatching(),
    errorHandling: evalSuites.errorHandling(),
    efficiency: evalSuites.efficiency(),
  }

  let allResults: EvalResult[] = []

  if (suiteName === 'all') {
    console.log('Running all eval suites...\n')
    for (const [name, suite] of Object.entries(suites)) {
      console.log(`\n📊 Running suite: ${suite.name}`)
      console.log('=' .repeat(50))
      const results = await runEvalSuite(suite)
      allResults.push(...results)
      
      // Print quick summary
      const passed = results.filter((r) => r.passed).length
      const total = results.length
      const mismatches = results.reduce((sum, r) => sum + r.metrics.toolUseIdMismatches, 0)
      console.log(`\n✅ Passed: ${passed}/${total}`)
      console.log(`🔗 ID Mismatches: ${mismatches}`)
      
      // Save individual suite results
      const report = generateEvalReport(results)
      const filename = `suite-${name}-${Date.now()}.md`
      await writeFile(join(outputDir, filename), report)
      console.log(`📄 Saved report: ${filename}`)
    }
  } else if (suites[suiteName as keyof typeof suites]) {
    const suite = suites[suiteName as keyof typeof suites]
    console.log(`\n📊 Running suite: ${suite.name}`)
    console.log('=' .repeat(50))
    allResults = await runEvalSuite(suite)
  } else {
    console.error(`Unknown suite: ${suiteName}`)
    console.error(`Available suites: ${Object.keys(suites).join(', ')}, all`)
    process.exit(1)
  }

  // Generate and save combined report
  if (allResults.length > 0) {
    const report = generateEvalReport(allResults)
    const filename = `combined-report-${Date.now()}.md`
    await writeFile(join(outputDir, filename), report)
    console.log(`\n📄 Saved combined report: ${filename}`)
    
    // Print summary
    console.log('\n' + '=' .repeat(50))
    console.log('📊 FINAL SUMMARY')
    console.log('=' .repeat(50))
    const passed = allResults.filter((r) => r.passed).length
    const total = allResults.length
    const totalToolCalls = allResults.reduce((sum, r) => sum + r.metrics.toolCallCount, 0)
    const totalErrors = allResults.reduce((sum, r) => sum + r.metrics.toolCallErrors, 0)
    const totalMismatches = allResults.reduce((sum, r) => sum + r.metrics.toolUseIdMismatches, 0)
    
    console.log(`Tests: ${passed}/${total} passed`)
    console.log(`Tool Calls: ${totalToolCalls}`)
    console.log(`Tool Errors: ${totalErrors} (${((totalErrors / totalToolCalls) * 100).toFixed(2)}%)`)
    console.log(`ID Mismatches: ${totalMismatches} ⚠️`)
    
    if (totalMismatches > 0) {
      console.log('\n❌ CRITICAL: Tool Use ID mismatches detected!')
      process.exit(1)
    }
  }
}

main().catch((error) => {
  console.error('Evaluation failed:', error)
  process.exit(1)
})

