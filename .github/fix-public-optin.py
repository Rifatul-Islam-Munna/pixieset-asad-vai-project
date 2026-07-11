from pathlib import Path

path = Path('frontend/components/dashboard/public-gallery.tsx')
text = path.read_text()
old = '''          marketingSubscriptionEnabled &&
            marketingOptIn.emailRegistration &&
            visitorMarketingOptIn,'''
new = '''          marketingSubscriptionEnabled &&
            marketingEmailRegistrationEnabled &&
            visitorMarketingOptIn,'''
if text.count(old) != 1:
    raise RuntimeError(f'Expected one email opt-in condition, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Public email registration marketing opt-in fixed')
