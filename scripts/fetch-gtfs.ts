import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync, createReadStream } from 'fs'
import { join } from 'path'
import { parse as parseSync } from 'csv-parse/sync'
import { parse as parseStream } from 'csv-parse'
import { pipeline } from 'stream/promises'
import unzipper from 'unzipper'

const GTFS_ZIP_URL = 'https://data.ptv.vic.gov.au/downloads/gtfs.zip'

const OUT_DIR = join(process.cwd(), 'public', 'data')
const SHAPES_DIR = join(OUT_DIR, 'shapes')
const LOOKUP_PATH = join(process.cwd(), 'src', 'lib', 'gtfs-lookup.json')
const TMP_DIR = join(process.cwd(), '.gtfs-tmp')

const ROUTE_TYPES_WE_WANT = ['0', '2']

async function downloadAndExtract(url: string, dest: string) {
  const tmpZip = join(dest, 'gtfs.zip')
  if (existsSync(tmpZip)) {
    console.log(`Using cached ${tmpZip}`)
  } else {
    console.log(`Downloading ${url}...`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to download: ${res.status}`)

    mkdirSync(dest, { recursive: true })

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    writeFileSync(tmpZip, buffer)
    console.log(`Downloaded to ${tmpZip}`)
  }

  // Delete previously extracted txt files so we can re-extract cleanly
  const needed = ['routes.txt', 'stops.txt', 'trips.txt', 'shapes.txt', 'stop_times.txt']
  for (const f of needed) {
    const p = join(dest, f)
    if (existsSync(p)) {
      const { unlinkSync } = await import('fs')
      unlinkSync(p)
    }
  }

  const directory = await unzipper.Open.file(tmpZip)

  let foundTxt = false

  // Check if top-level has .txt files or nested .zip files
  for (const entry of directory.files) {
    const name = entry.path.split('/').pop() || ''
    if (needed.includes(name)) {
      foundTxt = true
      const outPath = join(dest, name)
      await pipeline(entry.stream(), createWriteStream(outPath))
      console.log(`  Extracted ${name}`)
    }
  }

  // If no .txt files found, look for nested .zip files and extract from those
  if (!foundTxt) {
    console.log('  Top-level zip contains sub-zips, extracting nested...')
    for (const entry of directory.files) {
      if (entry.path.endsWith('.zip')) {
        const subZipName = entry.path.replace(/\//g, '_')
        const subZipPath = join(dest, subZipName)
        await pipeline(entry.stream(), createWriteStream(subZipPath))

        try {
          const subDir = await unzipper.Open.file(subZipPath)
          for (const subEntry of subDir.files) {
            const subName = subEntry.path.split('/').pop() || ''
            if (needed.includes(subName)) {
              const outPath = join(dest, subName)
              if (existsSync(outPath)) {
                // Merge across sub-zips: append data without header row using streaming
                const inputStream = subEntry.stream()
                const appendStream = createWriteStream(outPath, { flags: 'a' })
                let headerSkipped = false
                let leftover = Buffer.alloc(0)
                await new Promise<void>((resolve, reject) => {
                  inputStream.on('data', (chunk: Buffer) => {
                    if (headerSkipped) {
                      appendStream.write(chunk)
                      return
                    }
                    const combined = Buffer.concat([leftover, chunk])
                    const newlineIdx = combined.indexOf('\n')
                    if (newlineIdx !== -1) {
                      headerSkipped = true
                      leftover = Buffer.alloc(0)
                      const rest = combined.slice(newlineIdx + 1)
                      if (rest.length > 0) appendStream.write(rest)
                    } else {
                      leftover = combined
                    }
                  })
                  inputStream.on('end', () => { appendStream.end(); resolve() })
                  inputStream.on('error', reject)
                  appendStream.on('error', reject)
                })
              } else {
                await pipeline(subEntry.stream(), createWriteStream(outPath))
              }
              console.log(`  Extracted ${subName} from ${entry.path}`)
            }
          }
        } catch (e) {
          console.warn(`  Warning: Could not process ${entry.path}:`, e)
        }
      }
    }
  }
}

function parseCsvSmall(filePath: string): Record<string, string>[] {
  if (!existsSync(filePath)) {
    console.warn(`  Warning: ${filePath} not found, skipping`)
    return []
  }
  const content = readFileSync(filePath, 'utf-8')
  return parseSync(content, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true })
}

async function streamCsv(
  filePath: string,
  onRecord: (record: Record<string, string>) => void
): Promise<void> {
  if (!existsSync(filePath)) {
    console.warn(`  Warning: ${filePath} not found, skipping`)
    return
  }
  await new Promise<void>((resolve, reject) => {
    const parser = parseStream({ columns: true, skip_empty_lines: true, relax_column_count: true, bom: true })
    parser.on('readable', () => {
      let record: Record<string, string> | null
      while ((record = parser.read()) !== null) {
        onRecord(record)
      }
    })
    parser.on('error', reject)
    parser.on('end', resolve)
    createReadStream(filePath).pipe(parser)
  })
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(SHAPES_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })

  await downloadAndExtract(GTFS_ZIP_URL, TMP_DIR)

  const routesRaw = parseCsvSmall(join(TMP_DIR, 'routes.txt'))
  const stopsRaw = parseCsvSmall(join(TMP_DIR, 'stops.txt'))
  const tripsRaw = parseCsvSmall(join(TMP_DIR, 'trips.txt'))

  const relevantRoutes = routesRaw.filter(r => ROUTE_TYPES_WE_WANT.includes(r.route_type))
  const relevantRouteIds = new Set(relevantRoutes.map(r => r.route_id))

  const routes = relevantRoutes.map(r => ({
    id: r.route_id,
    name: r.route_long_name || r.route_short_name,
    shortName: r.route_short_name,
    color: r.route_color ? `#${r.route_color}` : (r.route_type === '2' ? '#0072CE' : '#78BE20'),
    type: r.route_type === '2' ? 'train' : 'tram',
  }))
  writeFileSync(join(OUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2))
  console.log(`Wrote ${routes.length} routes`)

  const relevantTrips = tripsRaw.filter(t => relevantRouteIds.has(t.route_id))
  const relevantShapeIds = new Set(relevantTrips.map(t => t.shape_id).filter(Boolean))

  const stops = stopsRaw
    .filter(s => s.location_type === '0' || s.location_type === '')
    .map(s => ({
      id: s.stop_id,
      name: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lng: parseFloat(s.stop_lon),
    }))
  writeFileSync(join(OUT_DIR, 'stops.json'), JSON.stringify(stops, null, 2))
  console.log(`Wrote ${stops.length} stops`)

  // Build shapes per route by streaming shapes.txt (large file)
  console.log('Processing shapes.txt (streaming)...')
  const shapePoints: Record<string, { lat: number; lng: number; seq: number }[]> = {}
  await streamCsv(join(TMP_DIR, 'shapes.txt'), (s) => {
    if (!relevantShapeIds.has(s.shape_id)) return
    if (!shapePoints[s.shape_id]) shapePoints[s.shape_id] = []
    shapePoints[s.shape_id].push({
      lat: parseFloat(s.shape_pt_lat),
      lng: parseFloat(s.shape_pt_lon),
      seq: parseInt(s.shape_pt_sequence),
    })
  })

  const routeToShape: Record<string, string> = {}
  for (const t of relevantTrips) {
    if (t.shape_id && !routeToShape[t.route_id]) {
      routeToShape[t.route_id] = t.shape_id
    }
  }

  for (const [routeId, shapeId] of Object.entries(routeToShape)) {
    const points = shapePoints[shapeId]
    if (!points) continue
    points.sort((a, b) => a.seq - b.seq)
    const coordinates = points.map(p => [p.lng, p.lat])
    writeFileSync(join(SHAPES_DIR, `${routeId}.json`), JSON.stringify(coordinates))
  }
  console.log(`Wrote ${Object.keys(routeToShape).length} shape files`)

  // Build route-to-stops mapping from stop_times.txt by streaming (large file)
  console.log('Processing stop_times.txt (streaming)...')
  const tripToRoute: Record<string, string> = {}
  for (const t of relevantTrips) {
    tripToRoute[t.trip_id] = t.route_id
  }

  // We only want one representative trip per route, so track the first trip we see per route
  const firstTripForRoute: Record<string, string> = {}
  for (const t of relevantTrips) {
    if (!firstTripForRoute[t.route_id]) {
      firstTripForRoute[t.route_id] = t.trip_id
    }
  }
  const wantedTripIds = new Set(Object.values(firstTripForRoute))

  const routeStopsMap: Record<string, { stopId: string; sequence: number }[]> = {}
  await streamCsv(join(TMP_DIR, 'stop_times.txt'), (st) => {
    if (!wantedTripIds.has(st.trip_id)) return
    const routeId = tripToRoute[st.trip_id]
    if (!routeId) return
    if (!routeStopsMap[routeId]) routeStopsMap[routeId] = []
    routeStopsMap[routeId].push({
      stopId: st.stop_id,
      sequence: parseInt(st.stop_sequence),
    })
  })

  const stopsById = Object.fromEntries(stops.map(s => [s.id, s]))
  const routeStops: Record<string, { id: string; name: string; lat: number; lng: number; sequence: number }[]> = {}
  for (const [routeId, stopList] of Object.entries(routeStopsMap)) {
    stopList.sort((a, b) => a.sequence - b.sequence)
    routeStops[routeId] = stopList
      .map(s => {
        const stop = stopsById[s.stopId]
        if (!stop) return null
        return { id: s.stopId, name: stop.name, lat: stop.lat, lng: stop.lng, sequence: s.sequence }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
  }
  writeFileSync(join(OUT_DIR, 'route-stops.json'), JSON.stringify(routeStops, null, 2))
  console.log(`Wrote route-stops mapping for ${Object.keys(routeStops).length} routes`)

  // Build lookup table for server-side enrichment
  const lookup = {
    routes: Object.fromEntries(routes.map(r => [r.id, { name: r.name, color: r.color }])),
    trips: Object.fromEntries(
      relevantTrips.map(t => [t.trip_id, { routeId: t.route_id, headsign: t.trip_headsign || '' }])
    ),
    stops: Object.fromEntries(stops.map(s => [s.id, s.name])),
  }
  mkdirSync(join(process.cwd(), 'src', 'lib'), { recursive: true })
  writeFileSync(LOOKUP_PATH, JSON.stringify(lookup, null, 2))
  console.log(`Wrote lookup table`)

  console.log('Done!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
