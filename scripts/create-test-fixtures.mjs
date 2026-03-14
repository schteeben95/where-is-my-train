/**
 * Creates synthetic GTFS-RT protobuf fixture files for testing.
 * Run with: node scripts/create-test-fixtures.mjs
 */
import protobuf from 'protobufjs'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const schema = `
  syntax = "proto2";

  message FeedMessage {
    required FeedHeader header = 1;
    repeated FeedEntity entity = 2;
  }

  message FeedHeader {
    required string gtfs_realtime_version = 1;
    optional uint64 timestamp = 5;
  }

  message FeedEntity {
    required string id = 1;
    optional VehiclePosition vehicle = 4;
  }

  message VehiclePosition {
    optional TripDescriptor trip = 1;
    optional VehicleDescriptor vehicle = 8;
    optional Position position = 2;
    optional uint32 current_stop_sequence = 3;
    optional string stop_id = 7;
    optional uint32 current_status = 4;
    optional uint64 timestamp = 5;
  }

  message Position {
    required float latitude = 1;
    required float longitude = 2;
    optional float bearing = 3;
    optional float speed = 5;
  }

  message TripDescriptor {
    optional string trip_id = 1;
    optional string route_id = 5;
    optional string start_date = 3;
    optional string start_time = 4;
  }

  message VehicleDescriptor {
    optional string id = 1;
    optional string label = 2;
  }
`

const root = protobuf.parse(schema).root
const FeedMessage = root.lookupType('FeedMessage')

// Metro train fixture
const trainFeed = {
  header: {
    gtfsRealtimeVersion: '2.0',
    timestamp: 1741910400,
  },
  entity: [
    {
      id: 'entity-1',
      vehicle: {
        trip: { tripId: 'trip-1001', routeId: 'route-sandringham', startDate: '20260314' },
        vehicle: { id: 'train-101', label: '101M' },
        position: { latitude: -37.8136, longitude: 144.9631, bearing: 180.0 },
        stopId: 'stop-flinders',
        currentStatus: 2, // IN_TRANSIT_TO
        timestamp: 1741910400,
      },
    },
    {
      id: 'entity-2',
      vehicle: {
        trip: { tripId: 'trip-1002', routeId: 'route-glen-waverley', startDate: '20260314' },
        vehicle: { id: 'train-202', label: '202M' },
        position: { latitude: -37.8496, longitude: 145.0850, bearing: 90.0 },
        stopId: 'stop-richmond',
        currentStatus: 1, // STOPPED_AT
        timestamp: 1741910390,
      },
    },
    {
      id: 'entity-3',
      vehicle: {
        trip: { tripId: 'trip-1003', routeId: 'route-frankston', startDate: '20260314' },
        vehicle: { id: 'train-303', label: '303M' },
        position: { latitude: -37.9105, longitude: 145.1349, bearing: 270.0 },
        stopId: 'stop-caulfield',
        currentStatus: 0, // INCOMING_AT
        timestamp: 1741910380,
      },
    },
  ],
}

// Tram fixture
const tramFeed = {
  header: {
    gtfsRealtimeVersion: '2.0',
    timestamp: 1741910400,
  },
  entity: [
    {
      id: 'tram-entity-1',
      vehicle: {
        trip: { tripId: 'tram-trip-96', routeId: 'route-96', startDate: '20260314' },
        vehicle: { id: 'tram-001', label: '001T' },
        position: { latitude: -37.8093, longitude: 144.9748, bearing: 45.0 },
        stopId: 'tram-stop-bourke',
        currentStatus: 2,
        timestamp: 1741910400,
      },
    },
    {
      id: 'tram-entity-2',
      vehicle: {
        trip: { tripId: 'tram-trip-86', routeId: 'route-86', startDate: '20260314' },
        vehicle: { id: 'tram-002', label: '002T' },
        position: { latitude: -37.8033, longitude: 144.9765, bearing: 135.0 },
        stopId: 'tram-stop-latrobe',
        currentStatus: 1,
        timestamp: 1741910395,
      },
    },
  ],
}

const verifyMessage = (feed, name) => {
  const err = FeedMessage.verify(feed)
  if (err) {
    console.error(`Verification failed for ${name}:`, err)
    process.exit(1)
  }
}

verifyMessage(trainFeed, 'trainFeed')
verifyMessage(tramFeed, 'tramFeed')

const trainBuffer = FeedMessage.encode(FeedMessage.create(trainFeed)).finish()
const tramBuffer = FeedMessage.encode(FeedMessage.create(tramFeed)).finish()

const fixturesDir = join(__dirname, '..', 'src', '__tests__', 'fixtures')

writeFileSync(join(fixturesDir, 'vehicle-positions.pb'), trainBuffer)
writeFileSync(join(fixturesDir, 'tram-positions.pb'), tramBuffer)

console.log(`Written vehicle-positions.pb (${trainBuffer.length} bytes)`)
console.log(`Written tram-positions.pb (${tramBuffer.length} bytes)`)
