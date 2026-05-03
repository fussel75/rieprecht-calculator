# Rieprecht Container Calculator

## Overview
This is an internal business tool for Rieprecht, a German container/waste disposal service. The application calculates pricing for container rentals by considering operational costs, material types, transport distances, and target profit margins. Its core purpose is to provide robust cost management, efficient material tracking, and accurate business planning forecasts to enhance profitability and operational efficiency. The project aims to streamline pricing, improve decision-making, and offer a competitive edge in the waste disposal market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **Charts**: Recharts.
- **Animations**: Framer Motion.
- **Forms**: React Hook Form with Zod validation.

### Backend
- **Runtime**: Node.js with Express.
- **Language**: TypeScript with ESM modules.
- **Development**: Vite dev server with HMR proxy through Express.
- **Production Build**: esbuild.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Defined in `shared/schema.ts`, shared between client/server.
- **Migrations**: Drizzle Kit.
- **Connection**: node-postgres (pg) pool.

### API Design
- **Style**: REST endpoints under `/api/*`.
- **Route Definitions**: Centralized in `shared/routes.ts` with Zod schemas for type safety and validation.

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend.
- `shared/`: Code shared between client and server, including Drizzle schema and API route definitions.

### Build System
- **Development**: `npm run dev` (tsx with Vite middleware).
- **Production**: `npm run build` (bundled output in `dist/`).
- **Database**: `npm run db:push` (schema sync).

### Core Features
- **Dual Order Types**: Supports both "Entsorgung" (waste disposal) and "Lieferung" (bulk material delivery/Schüttgüter). Materials have a `materialType` field ('entsorgung' or 'lieferung'). The calculator toggles between modes, filtering materials accordingly. Delivery materials have `purchaseCostPerTonne` (purchase price) and `grainSize` fields.
- **Pricing Calculation**: Calculates container rental prices based on various parameters including material, distance, and profit margins.
- **Multi-Container Support**: Allows for ordering one or two containers with different material types and quantity inputs, adjusting costs based on transport options (e.g., trailer usage).
- **Cost Management**: Integrates operational costs, vehicle, employee, and loan management into overall calculations.
- **Sales Price Management**: System for managing material and fixed sales prices, including PDF import for price list recognition using OpenAI.
- **Market Comparison**: Displays a triple price comparison (calculation, list price, market price) with AI-based market price estimations from competitors. Web-scraping from real Hamburg-area providers (Curanto, ecoservice24, Containerdienst.de, BUHCK Shop, etc.) with OpenAI extraction, plus BUHCK/Junkbusters direct APIs and KI-Fallback. Auto-refresh on server start + every 24h.
- **Financial Tracking**: Includes detailed loan management with payment history, interest, and principal tracking.
- **User Authentication & Authorization**: Features a robust authentication system with email verification, password reset, and role-based access control (admin, manager, mitarbeiter).
- **Customer Management**: Comprehensive customer database with contact details, types (private/commercial), and discount management.
- **Quick Offer System**: Enables sending professional HTML email offers directly from the price calculator, with personalized content and ordering options.
- **Article Master (Artikelstamm)**: Manages articles from the dispatch software with article number, name, unit (m³/t/Stk/Std), category (Entsorgung/Service/Lieferung/Zuschlag), AVV number. Supports PDF import with AI extraction and manual CRUD.
- **Extended Trip Logging**: Records trips with vehicle (license plate), customer, construction site, order type (Abholen/Leeren/Wechsel/Aufstellen/Transport/Beladen), article reference, container size, quantity with unit, distance, and price. Revenue overview with time period filter (week/month/half-year/year/custom) showing total revenue, trip count, and average per trip.
- **BWA (Betriebswirtschaftliche Auswertung)**: PDF import of BWA reports with AI extraction, monthly overview with revenue/cost breakdown, cumulative results, and year filtering.
- **Reporting**: Provides actual vs. planned comparisons on the Planning page and detailed trip logging. Forecast Center integrates real IST trip data from the trips table into monthly projections, showing Plan vs. IST comparisons with IST badges, actual trip counts/revenue, and delta calculations for completed months.
- **PDF Export**: Browser-based HTML-to-print export for 5 sections: Forecast, Calculator, Planning, Trips, Customers. Server returns HTML, browser opens in new tab with native print dialog for "Save as PDF".
- **Price Optimization**: "Preisoptimierung" tab in Forecast Center with strategy-based pricing (Marktpreis, Markt−X%, Listenpreis, Kosten+X€). Features editable per-material target prices, market-based status indicators (Unter Kosten/Unter Markt/Am Markt/Über Markt), quick-action buttons to bulk-set all prices, and dynamic annual impact calculation. Supports applying custom target prices to sales_prices table, plus PDF/CSV export.
- **Trip Import**: CSV and PDF file import for trips. CSV auto-detects separators/columns/German dates. PDF uses OpenAI to extract structured trip data. Both support preview-before-import.
- **Partner API**: Complete REST API under `/api/partner/` for external app integration. Authenticated via `x-api-key` header with role-based permissions (read/write/admin). Endpoints: Products CRUD, Variants CRUD, Orders CRUD, Customers CRUD (reuses existing table), Calendar (delivery scheduling), Geo Zones (PLZ delivery areas), PLZ Exceptions (special rules), Settings, Dashboard (statistics), API Key management, Price Calculator (uses internal materials + sales prices), Materials list (read-only), Price list (read-only). Schema tables: `partner_api_keys`, `partner_products`, `partner_variants`, `partner_orders`, `partner_calendar`, `partner_geo_zones`, `partner_plz_exceptions`, `partner_settings`. Routes: `server/partnerRoutes.ts`, mounted in `server/index.ts`.
- **Localization**: German currency formatting (1.234,56 €) and localized error messages.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.

### UI/Component Libraries
- **Radix UI**: Accessible primitives.
- **shadcn/ui**: Pre-built component library.
- **Lucide React**: Icon library.

### Key NPM Packages
- `drizzle-orm` / `drizzle-zod`: ORM.
- `@tanstack/react-query`: Server state management.
- `react-hook-form` / `@hookform/resolvers`: Form handling.
- `recharts`: Charting.
- `framer-motion`: Animation.
- `date-fns`: Date manipulation.
- `wouter`: Routing.
- `connect-pg-simple`: PostgreSQL session store.
- `resend`: Email sending service.
- `pdf-parse`, `multer`: For PDF import functionality.
- `openai`: For AI-driven PDF content extraction and market price estimations.

### Development Tools
- `vite`: Frontend build tool.
- `esbuild`: Server bundling.
- `tsx`: TypeScript execution.
- `drizzle-kit`: Database migration.