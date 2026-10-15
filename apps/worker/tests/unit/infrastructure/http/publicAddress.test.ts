import { describe, expect, it } from "vitest";
import { isPublicAddress } from "@/infrastructure/http/publicAddress";

describe("isPublicAddress", () => {
  it.each([
    ["8.8.8.8"],
    ["93.184.216.34"],
    ["2606:4700:4700::1111"],
    ["2a00:1450:4001:80b::200e"],
    // An IPv4-mapped IPv6 address is judged by the IPv4 address inside it.
    ["::ffff:8.8.8.8"],
  ])("allows the public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    // IPv4
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback"],
    ["10.0.0.1", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.255", "private"],
    ["192.168.1.1", "private"],
    ["169.254.169.254", "the metadata service"],
    ["169.254.1.1", "link-local"],
    ["0.0.0.0", "unspecified"],
    ["100.100.100.200", "carrier-grade NAT"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "broadcast"],
    // IPv6
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fe80::1", "link-local"],
    ["fc00::1", "unique local"],
    ["fd00:ec2::254", "unique local (a metadata service)"],
    ["ff02::1", "multicast"],
    // IPv4 inside IPv6
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:7f00:1", "IPv4-mapped loopback, hex form"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata service"],
    ["::ffff:10.0.0.1", "IPv4-mapped private"],
    ["::127.0.0.1", "IPv4-compatible loopback"],
    ["64:ff9b::a9fe:a9fe", "NAT64 of the metadata service"],
    // Not an address
    ["localhost", "a hostname"],
    ["", "empty"],
  ])("refuses %s (%s)", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
