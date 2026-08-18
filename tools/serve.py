#!/usr/bin/env python3
"""Serve the repository root for local development.

`python3 -m http.server 8000` fails outright when 8000 is already taken, which
it usually is because an earlier session, or Docker, is still holding it. This
takes the next free port instead, and prints the address a phone or tablet on
the same network can reach, since the touch targets are the thing most worth
checking on a real device.

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


def serve_near(handler, start):
    """A server bound to `start`, or the next free port after it.

    Binding the real socket and catching the failure, rather than probing with
    a throwaway socket first: a probe closes the port before the server claims
    it, and another process can take it in between.

    The kernel will hand out any free port if asked for port 0, which needs no
    loop at all. That is the fallback rather than the default, because a port
    near 8000 is one you can type into a tablet, and 54948 is not.
    """
    for port in range(start, start + TRIES):
        try:
            return http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)
        except OSError:
            continue
    return http.server.ThreadingHTTPServer(("0.0.0.0", 0), handler)


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

    os.chdir(ROOT)
    server = serve_near(http.server.SimpleHTTPRequestHandler, asked)
    port = server.server_address[1]

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
