"""Install only a digest-pinned, previously reviewed public CI input archive."""
import hashlib
import io
import os
from pathlib import Path, PurePosixPath
import tarfile
import urllib.request
from urllib.parse import urlparse

url = os.environ.get('FORMICARIUM_CI_INPUT_URL', '')
expected = os.environ.get('FORMICARIUM_CI_INPUT_SHA256', '')
parsed = urlparse(url)
if parsed.scheme != 'https' or parsed.username or parsed.password or len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
    raise SystemExit('reviewed HTTPS URL and archive SHA256 required')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('redirected input URL is not approved')
with urllib.request.build_opener(NoRedirect).open(url, timeout=120) as response:
    data = response.read(2_000_000_001)
if len(data) > 2_000_000_000 or hashlib.sha256(data).hexdigest() != expected:
    raise SystemExit('input archive size or SHA256 differs')
root = Path('.ci-inputs')
root.mkdir()
with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
    seen = set()
    total = 0
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        if path.is_absolute() or any(part in ('..', '.') for part in path.parts) or str(path) in seen or not member.isfile():
            raise SystemExit('unsafe, duplicate, or nonregular input archive member')
        seen.add(str(path))
        if str(path) != 'manifest.json' and not str(path).startswith('payload/'):
            raise SystemExit('unknown archive member')
        total += member.size
        if total > 4_000_000_000:
            raise SystemExit('input archive expanded size exceeds limit')
        target = root / str(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.extractfile(member) as source:
            target.write_bytes(source.read())
