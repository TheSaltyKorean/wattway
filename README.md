# WattWay ⚡

**Cost-optimized EV trip planner.** Most EV apps find chargers — WattWay finds the *cheapest* way to get from A to B, picking the optimal sequence of charging stops based on network prices, detour distance, and your vehicle's range.

![WattWay screenshot](public/screenshot.png)

## How the optimizer works

1. **Route**: Fetches driving directions from Mapbox
2. **Chargers**: Pulls all DC Fast Charge stations within 10 miles of your route from Open Charge Map
3. **Pricing**: Applies known $/kWh rates per charging network (user-adjustable)
4. **Optimization**: Greedy forward-search that:
   - Tracks your battery state of charge (SoC) mile by mile
   - Never lets you drop below 10% SoC
   - Scores each candidate stop by `(energy_cost + detour_penalty)`
   - Charges to 80% at each stop (optimal for DCFC speed)
   - Skips expensive chargers if a cheaper one is within reach

## Setup

### 1. Clone and install

```bash
git clone https://github.com/TheSaltyKorean/wattway.git
cd wattway
npm install
```

### 2. API keys

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

**Mapbox** (required for routing and map):
- Sign up at [mapbox.com](https://account.mapbox.com/)
- Free tier: 50,000 map loads/month
- Add your public token as `NEXT_PUBLIC_MAPBOX_TOKEN`

**Open Charge Map** (optional):
- API works without a key but rate-limited
- Get a free key at [openchargemap.org](https://openchargemap.org/site/develop/api)
- Add as `NEXT_PUBLIC_OCM_API_KEY`

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Default network prices ($/kWh)

| Network | Price |
|---------|-------|
| Tesla Supercharger | $0.28 |
| ChargePoint | $0.31 |
| EVgo | $0.36 |
| Blink | $0.39 |
| Electrify America | $0.43 |

Prices vary by location and membership. The app uses these as defaults — pricing settings will be editable in a future update.

## Vehicle database

Includes 12 popular EVs with accurate battery size, range, max charge rate, and efficiency. Adding more is easy — edit `lib/evDatabase.ts`.

## Deploy to Vercel

```bash
npx vercel
```

Set `NEXT_PUBLIC_MAPBOX_TOKEN` in your Vercel project environment variables.

## Roadmap

- [ ] Real-time pricing via network APIs
- [ ] Membership pricing (EA Pass+, etc.)
- [ ] Multiple route alternatives with cost comparison
- [ ] Time-of-use pricing awareness
- [ ] Share trip link
- [ ] Mobile PWA

## License

MIT
