#!/usr/bin/env python3
"""Serve the repository root for local development.

`python3 -m http.server 8000` fails outright when 8000 is already taken, which
it usually is because an earlier session is still running. This walks up from
the requested port until it finds a free one, and prints the address a phone or
tablet on the same network can reach, since the touch targets are the thing
most worth checking on a real device.

Usage:
    python3 tools/serve.py [port]     # default 8000, or the first free port after it
"""

import http.server
import os
import socket
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRST = 8000
TRIES = 50


def free_port(start):
    """First port from `start` that nothing is listening on."""
    for port in range(start, start + TRIES):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("0.0.0.0", port))
            except OSError:
                continue
            return port
    raise SystemExit(f"no free port between {start} and {start + TRIES - 1}")


def lan_addresses():
    """Addresses this machine may be reachable at on the local network.

    Two sources, because neither is reliable alone: the hostname lookup misses
    some setups, and the route trick happily returns a VPN tunnel address that
    no tablet on the wifi can reach. Print every candidate rather than guess
    wrong, ordered with the hostname's first since that is usually the wifi.
    """
    found = []

    def add(ip):
        if ip and not ip.startswith("127.") and ip not in found:
            found.append(ip)

    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            add(ip)
    except OSError:
        pass

    # connect() on UDP sends nothing; it just picks the route, which names the
    # interface we would leave the machine by.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            add(s.getsockname()[0])
        except OSError:
            pass

    return found


def main():
    asked = int(sys.argv[1]) if len(sys.argv) > 1 else FIRST
    port = free_port(asked)

    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)

    if port != asked:
        print(f"port {asked} was busy, using {port}")
    print(f"serving {ROOT}")
    print(f"  local    http://localhost:{port}")
    lan = lan_addresses()
    for i, ip in enumerate(lan):
        label = "network " if i == 0 else "        "
        print(f"  {label} http://{ip}:{port}")
    if len(lan) > 1:
        print("  (several interfaces: use the one on the same wifi as the tablet)")
    elif lan:
        print("  (reachable from a phone or tablet on the same wifi)")
    print("ctrl-c to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
