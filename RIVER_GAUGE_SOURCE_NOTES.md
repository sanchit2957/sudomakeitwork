# River Gauge Source Assessment

The **National Water Data Portal**, operated by the National Water Informatics Centre under the Government of India’s Ministry of Jal Shakti, publishes an Assam Department dataset titled *River Water Level (Telemetry - Hourly), Assam Department*. It provides station identifier, district, river, geographic coordinates, acquisition time, and water level in metres, with CSV and API resources listed on the official dataset page.[1]

The currently published 2026–2030 CSV resource was retrieved for inspection. Its most recent row was dated **3 June 2026**, despite the dataset metadata page showing a later portal update. The product must therefore treat a reading as unavailable when its source timestamp exceeds a conservative freshness window; no stale value may be labelled live.

The Assam SMART AXOM public dashboard was also inspected, but automated access was blocked by a CAPTCHA and did not expose a stable unauthenticated water-level endpoint in this environment. It is therefore not suitable as a production automated source without documented access approval.

## Proposed integration rule

The server should retrieve the official NWDP Assam telemetry CSV, select the nearest station to the victim’s current coordinate, derive a trend from recent observations at that station, and return the station name, observation timestamp, level in metres, source URL, and freshness status. If the source cannot be read, has no local station, or is stale, the user interface must show **unavailable** with the official source link rather than estimate a river level.

## Live integration verification

The implemented public conditions query retrieved the official dataset and displayed its attribution link together with the returned observation timestamp (**3 June 2026, 17:30 local browser display**). Because that value exceeded the 48-hour freshness window, the user interface showed **Unavailable** and explicitly stated that the official reading was **1,920 hours old and is not shown as live**. This confirms that the integration is connected while avoiding an unsafe stale-data claim.

[1]: https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department
