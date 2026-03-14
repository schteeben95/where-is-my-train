import protobuf from 'protobufjs'

interface RawVehicle {
  id: string
  type: 'train' | 'tram'
  lat: number
  lng: number
  bearing: number
  routeId: string
  tripId: string
  stopId: string
  status: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO'
  timestamp: number
}

const STATUS_MAP: Record<number, RawVehicle['status']> = {
  0: 'INCOMING_AT',
  1: 'STOPPED_AT',
  2: 'IN_TRANSIT_TO',
}

let cachedFeedMessageType: protobuf.Type | null = null

function getFeedMessageType(): protobuf.Type {
  if (cachedFeedMessageType) return cachedFeedMessageType

  const gtfsRoot = protobuf.parse(`
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
  `).root

  cachedFeedMessageType = gtfsRoot.lookupType('FeedMessage')
  return cachedFeedMessageType
}

export function parseVehiclePositions(
  buffer: Buffer | Uint8Array,
  vehicleType: 'train' | 'tram'
): RawVehicle[] {
  if (!buffer || buffer.length === 0) return []

  try {
    const FeedMessage = getFeedMessageType()
    const decoded = FeedMessage.decode(
      buffer instanceof Buffer ? new Uint8Array(buffer) : buffer
    ) as any

    const vehicles: RawVehicle[] = []

    for (const entity of decoded.entity || []) {
      const v = entity.vehicle
      if (!v?.position) continue

      // protobufjs converts snake_case to camelCase by default
      vehicles.push({
        id: v.vehicle?.id || entity.id,
        type: vehicleType,
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing || 0,
        routeId: v.trip?.routeId || '',
        tripId: v.trip?.tripId || '',
        stopId: v.stopId || '',
        status: STATUS_MAP[v.currentStatus ?? 2] || 'IN_TRANSIT_TO',
        timestamp: Number(v.timestamp || 0),
      })
    }

    return vehicles
  } catch (err) {
    console.error('Failed to parse GTFS-RT feed:', err)
    return []
  }
}
