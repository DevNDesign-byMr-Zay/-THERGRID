import { validateHolographicRenderPacket } from './holographic-renderer-contract.mjs';

export function assertRenderPacketSafe(packet) {
  if (!validateHolographicRenderPacket(packet))
    throw new TypeError('invalid holographic render packet');
  if (packet.safety?.authoritative !== false)
    throw new TypeError('render packet cannot be authoritative');
  if (packet.safety?.actuatesHardware !== false)
    throw new TypeError('render packet cannot actuate hardware');
  if (packet.safety?.advisoryOnly !== true)
    throw new TypeError('render packet must remain advisory');
  return true;
}
