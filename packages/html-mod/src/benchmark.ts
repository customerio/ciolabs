/**
 * Benchmark comparing original (manual flush) vs experimental (auto-flush) implementations
 */

/* eslint-disable unicorn/no-array-push-push, unused-imports/no-unused-vars */
import { HtmlMod as HtmlModExperimental } from './index.experimental.js';
import { HtmlMod as HtmlModOriginal } from './index.js';

interface BenchmarkResult {
  name: string;
  original: number;
  experimental: number;
  speedup: string;
  winner: 'original' | 'experimental' | 'tie';
}

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}µs`;
  }
  return `${ms.toFixed(2)}ms`;
}

function benchmark(_name: string, function_: () => void, iterations = 1000): number {
  // Warmup
  for (let index = 0; index < 10; index++) {
    function_();
  }

  // Actual benchmark
  const start = performance.now();
  for (let index = 0; index < iterations; index++) {
    function_();
  }
  const end = performance.now();

  return (end - start) / iterations;
}

function runBenchmark(
  name: string,
  originalFunction: () => void,
  experimentalFunction: () => void,
  iterations = 1000
): BenchmarkResult {
  console.log(`\nRunning: ${name}...`);

  const originalTime = benchmark(name + ' (original)', originalFunction, iterations);
  const experimentalTime = benchmark(name + ' (experimental)', experimentalFunction, iterations);

  const ratio = originalTime / experimentalTime;
  const winner = ratio > 1.1 ? 'experimental' : ratio < 0.9 ? 'original' : 'tie';
  const speedup =
    winner === 'experimental'
      ? `${ratio.toFixed(2)}x faster`
      : winner === 'original'
        ? `${(1 / ratio).toFixed(2)}x slower`
        : 'similar';

  console.log(`  Original:     ${formatTime(originalTime)}`);
  console.log(`  Experimental: ${formatTime(experimentalTime)}`);
  console.log(`  Winner:       ${winner === 'tie' ? 'TIE' : winner.toUpperCase()} (${speedup})`);

  return {
    name,
    original: originalTime,
    experimental: experimentalTime,
    speedup,
    winner,
  };
}

// Test cases
const simpleHTML = '<div><p>Hello World</p></div>';
const complexHTML = Array.from(
  { length: 100 },
  (_, index) => `<div id="item-${index}" class="item"><p>Item ${index}</p><span>Description</span></div>`
).join('');
const deeplyNestedHTML = (() => {
  let html = '<div>';
  for (let index = 0; index < 50; index++) {
    html += `<div class="level-${index}">`;
  }
  html += 'Deep content';
  for (let index = 0; index < 50; index++) {
    html += '</div>';
  }
  html += '</div>';
  return html;
})();

const results: BenchmarkResult[] = [];

console.log('='.repeat(70));
console.log('HTML-MOD BENCHMARK: Original vs Experimental (Auto-Flush)');
console.log('='.repeat(70));

// Benchmark 1: Simple parsing
results.push(
  runBenchmark(
    'Parse simple HTML',
    () => {
      new HtmlModOriginal(simpleHTML);
    },
    () => {
      new HtmlModExperimental(simpleHTML);
    },
    10_000
  )
);

// Benchmark 2: Parse + single attribute modification
results.push(
  runBenchmark(
    'Parse + setAttribute (with flush)',
    () => {
      const html = new HtmlModOriginal(simpleHTML);
      const div = html.querySelector('div')!;
      div.setAttribute('id', 'test');
      html.flush();
    },
    () => {
      const html = new HtmlModExperimental(simpleHTML);
      const div = html.querySelector('div')!;
      div.setAttribute('id', 'test');
    },
    5000
  )
);

// Benchmark 3: Parse + query without flush (should be fast for original, same for experimental)
results.push(
  runBenchmark(
    'Parse + query (no modifications)',
    () => {
      const html = new HtmlModOriginal(simpleHTML);
      html.querySelector('p');
    },
    () => {
      const html = new HtmlModExperimental(simpleHTML);
      html.querySelector('p');
    },
    10_000
  )
);

// Benchmark 4: Multiple modifications + single flush vs auto-flush
results.push(
  runBenchmark(
    '10 modifications + flush',
    () => {
      const html = new HtmlModOriginal(simpleHTML);
      const div = html.querySelector('div')!;
      for (let index = 0; index < 10; index++) {
        div.setAttribute(`data-${index}`, `value-${index}`);
      }
      html.flush();
    },
    () => {
      const html = new HtmlModExperimental(simpleHTML);
      const div = html.querySelector('div')!;
      for (let index = 0; index < 10; index++) {
        div.setAttribute(`data-${index}`, `value-${index}`);
      }
    },
    1000
  )
);

// Benchmark 5: Complex HTML parsing
results.push(
  runBenchmark(
    'Parse complex HTML (100 elements)',
    () => {
      new HtmlModOriginal(complexHTML);
    },
    () => {
      new HtmlModExperimental(complexHTML);
    },
    1000
  )
);

// Benchmark 6: Complex HTML + modifications + queries
results.push(
  runBenchmark(
    'Complex: modify + query pattern',
    () => {
      const html = new HtmlModOriginal(complexHTML);
      const items = html.querySelectorAll('.item');
      items[0].dataset.first = 'true';
      html.flush();
      html.querySelectorAll('.item');
      items[50].dataset.middle = 'true';
      html.flush();
    },
    () => {
      const html = new HtmlModExperimental(complexHTML);
      const items = html.querySelectorAll('.item');
      items[0].dataset.first = 'true';
      html.querySelectorAll('.item');
      items[50].dataset.middle = 'true';
    },
    1000
  )
);

// Benchmark 7: innerHTML modifications
results.push(
  runBenchmark(
    'innerHTML modification + flush',
    () => {
      const html = new HtmlModOriginal(simpleHTML);
      const div = html.querySelector('div')!;
      div.innerHTML = '<span>New content</span>';
      html.flush();
    },
    () => {
      const html = new HtmlModExperimental(simpleHTML);
      const div = html.querySelector('div')!;
      div.innerHTML = '<span>New content</span>';
    },
    5000
  )
);

// Benchmark 8: Remove operations
results.push(
  runBenchmark(
    'Remove element + flush',
    () => {
      const html = new HtmlModOriginal(simpleHTML);
      const p = html.querySelector('p')!;
      p.remove();
      html.flush();
    },
    () => {
      const html = new HtmlModExperimental(simpleHTML);
      const p = html.querySelector('p')!;
      p.remove();
    },
    5000
  )
);

// Benchmark 9: Deeply nested HTML
results.push(
  runBenchmark(
    'Parse deeply nested HTML (50 levels)',
    () => {
      new HtmlModOriginal(deeplyNestedHTML);
    },
    () => {
      new HtmlModExperimental(deeplyNestedHTML);
    },
    1000
  )
);

// Benchmark 10: Real-world pattern: template rendering
results.push(
  runBenchmark(
    'Real-world: build list from template',
    () => {
      const html = new HtmlModOriginal('<div id="list"></div>');
      const list = html.querySelector('#list')!;
      const items = Array.from({ length: 10 }, (_, index) => `<li>Item ${index}</li>`).join('');
      list.innerHTML = `<ul>${items}</ul>`;
      html.flush();
      const lis = html.querySelectorAll('li');
      lis[0].setAttribute('class', 'first');
      html.flush();
    },
    () => {
      const html = new HtmlModExperimental('<div id="list"></div>');
      const list = html.querySelector('#list')!;
      const items = Array.from({ length: 10 }, (_, index) => `<li>Item ${index}</li>`).join('');
      list.innerHTML = `<ul>${items}</ul>`;
      const lis = html.querySelectorAll('li');
      lis[0].setAttribute('class', 'first');
    },
    2000
  )
);

// Summary
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

const wins = {
  original: results.filter(r => r.winner === 'original').length,
  experimental: results.filter(r => r.winner === 'experimental').length,
  tie: results.filter(r => r.winner === 'tie').length,
};

console.log(`\nResults:`);
console.log(`  Original wins:     ${wins.original}`);
console.log(`  Experimental wins: ${wins.experimental}`);
console.log(`  Ties:              ${wins.tie}`);

console.log(`\nDetailed results:`);
console.log('-'.repeat(70));
for (const r of results) {
  const icon = r.winner === 'experimental' ? '✓' : r.winner === 'original' ? '✗' : '~';
  console.log(`${icon} ${r.name.padEnd(40)} ${r.speedup}`);
}

console.log('\n' + '='.repeat(70));

// Determine overall winner
if (wins.experimental > wins.original) {
  console.log('🎉 WINNER: Experimental (Auto-Flush)');
  console.log('The auto-flush implementation is generally faster for most operations.');
} else if (wins.original > wins.experimental) {
  console.log('⚠️  WINNER: Original (Manual Flush)');
  console.log('The manual flush implementation is generally faster.');
  console.log('Consider keeping the original for production use.');
} else {
  console.log('🤝 RESULT: TIE');
  console.log('Both implementations have similar performance.');
  console.log('Choose based on API convenience rather than performance.');
}

console.log('='.repeat(70));
