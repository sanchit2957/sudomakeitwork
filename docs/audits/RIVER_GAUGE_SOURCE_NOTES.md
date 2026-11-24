# River Gauge Source Assessment

The **National Water Data Portal**, operated by the National Water Informatics Centre under the Government of India’s Ministry of Jal Shakti, publishes an Assam Department dataset titled *River Water Level (Telemetry - Hourly), Assam Department*. It provides station identifier, district, river, geographic coordinates, acquisition time, and water level in metres, with CSV and API resources listed on the official dataset page.[1]

The currently published 2026–2030 CSV resource was retrieved for inspection. Its most recent row was dated **3 June 2026**, despite the dataset metadata page showing a later portal update. The product must therefore treat a reading as unavailable when its source timestamp exceeds a conservative freshness window; no stale value may be labelled live.

The Assam SMART AXOM public dashboard was also inspected, but automated access was blocked by a CAPTCHA and did not expose a stable unauthenticated water-level endpoint in this environment. It is therefore not suitable as a production automated source without documented access approval.

## Proposed integration rule

The server should retrieve the official NWDP Assam telemetry CSV, select the nearest station to the victim’s current coordinate, derive a trend from recent observations at that station, and return the station name, observation timestamp, level in metres, source URL, and freshness status. If the source cannot be read, has no local station, or is stale, the user interface must show **unavailable** with the official source link rather than estimate a river level.

## Live integration verification

The implemented public conditions query retrieved the official dataset and displayed its attribution link together with the returned observation timestamp (**3 June 2026, 17:30 local browser display**). Because that value exceeded the 48-hour freshness window, the user interface showed **Unavailable** and explicitly stated that the official reading was **1,920 hours old and is not shown as live**. This confirms that the integration is connected while avoiding an unsafe stale-data claim.

## Follow-up source investigation (22 August 2026)

The National Water Data Portal dataset metadata reports an update on 22 August 2026, but its publicly queryable datastore contains only 626 Assam observations and begins with 7 May 2026 records; the published resource still has no observation newer than 3 June 2026. The standard datastore query endpoint works, while its SQL query action is not enabled. The Assam SMART AXOM dashboard is official but blocks automated access behind CAPTCHA, and the CWC flood-forecast web application closed the connection in this environment. Neither is suitable for an unattended integration unless it provides an approved, documented public data interface.

An independently operated Assam river observatory was then inspected. It displays Central Water Commission-attributed observations with station identifiers, observation timestamps, official CWC station links, and a public `https://assamflood.org/data/current.json` data feed. At inspection it reported a Dibrugarh observation of 104.82 m at 22 August 2026, 16:30, with a CWC station reference. Any use of this source must remain explicitly labelled as a CWC-attributed value relayed by Axom Flood, must retain the CWC station link, and must keep a strict freshness check.

After the initial fallback implementation, the public app still returned its generic temporary-unavailable state for the Guwahati fallback location. This requires server-side request-path debugging before the source change can be accepted; the public UI must not claim a current CWC reading until the full contract returns it successfully.

The failure was traced to resolving the feed index’s relative content URL against `/data/current.json`, which incorrectly duplicated the `/data/` path. After resolving it against the Axom Flood origin and allowlisting its `/data/` payload path, the public app successfully displayed the fresh CWC-attributed Guwahati D.C. Court gauge: **47.32 m**, falling, observed 22 August 2026 at 15:30 local display time, approximately 5.6 km from the default map point. The rendered attribution links directly to the matching CWC station page and makes clear that Axom Flood relays the CWC observation.

[1]: https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department
