import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

// شکل‌ها فقط مرز جغرافیایی‌اند؛ هیچ عدد فروش یا سود در این فایل تولید نمی‌شود.
const topology = JSON.parse(readFileSync('node_modules/us-atlas/states-albers-10m.json', 'utf8'));
const path = geoPath();
const shapes = feature(topology, topology.objects.states).features.map(state => ({
  name: state.properties.name,
  id: state.id,
  path: path(state),
  center: path.centroid(state),
}));
mkdirSync('src/assets', { recursive: true });
writeFileSync('src/assets/us-states.json', JSON.stringify(shapes));
mkdirSync('public/fonts', { recursive: true });
copyFileSync('node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2', 'public/fonts/Vazirmatn.woff2');
copyFileSync('node_modules/vazirmatn/OFL.txt', 'public/fonts/OFL.txt');
copyFileSync('node_modules/us-atlas/LICENSE', 'src/assets/US-ATLAS-LICENSE.txt');
console.log(`Prepared ${shapes.length} state shapes and the local font.`);
