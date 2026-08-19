export function hasValidHospitalCapacity(
  totalEmergencyBeds: number,
  availableEmergencyBeds: number,
  totalIcuBeds: number,
  availableIcuBeds: number,
) {
  return availableEmergencyBeds <= totalEmergencyBeds && availableIcuBeds <= totalIcuBeds;
}
