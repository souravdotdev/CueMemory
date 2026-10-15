import { BlockList, isIP } from "node:net";

// Addresses inside a network (or no real host at all) that a fetch of a
// User's Source URL must never reach. Node's BlockList also matches an
// IPv4-mapped IPv6 address (::ffff:a.b.c.d) against the IPv4 ranges.
const BLOCKED_IPV4: readonly [string, number][] = [
  ["0.0.0.0", 8], // "this network", unspecified
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT (some clouds' metadata, e.g. 100.100.100.200)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. the 169.254.169.254 metadata service
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast
];

const BLOCKED_IPV6: readonly [string, number][] = [
  ["::", 96], // unspecified, and IPv4-compatible (deprecated) addresses
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64 (embeds an IPv4 address)
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard
  ["2001::", 32], // Teredo (embeds an IPv4 address)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (embeds an IPv4 address)
  ["fc00::", 7], // unique local, incl. fd00:ec2::254 (a metadata service)
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
];

const blocked = new BlockList();
for (const [network, prefix] of BLOCKED_IPV4) blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of BLOCKED_IPV6) blocked.addSubnet(network, prefix, "ipv6");

/**
 * Whether an IP address is a public one a fetch may connect to: not loopback,
 * private, link-local, unique-local, unspecified, metadata, multicast or
 * reserved, in IPv4 or IPv6 (IPv4-mapped IPv6 included). Anything that isn't
 * an IP address isn't public.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}
