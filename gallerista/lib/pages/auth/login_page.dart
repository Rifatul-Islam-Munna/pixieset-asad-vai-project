import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/auth/auth_api.dart';
import 'package:gallerista/core/auth/auth_cms.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/core/utils/app_toast.dart';
import 'package:gallerista/pages/auth/auth_widgets.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

enum _LoginMode { password, pin }

@RoutePage()
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  final _pin = TextEditingController();
  var _mode = _LoginMode.password;
  var _obscure = true;
  var _pending = false;
  var _sendingPin = false;
  String? _error;
  AuthCopy _copy = const AuthCopy();

  @override
  void initState() {
    super.initState();
    AuthCopy.load().then((copy) {
      if (mounted) setState(() => _copy = copy);
    });
  }

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    _pin.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final login = _login.text.trim();
    final secret = _mode == _LoginMode.pin ? _pin.text : _password.text;
    if (login.isEmpty || secret.isEmpty) {
      setState(() => _error = 'Enter your email or phone number and '
          '${_mode == _LoginMode.pin ? 'PIN' : 'password'}.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      if (_mode == _LoginMode.pin) {
        await AuthApi.loginWithPin(login: login, pin: secret);
      } else {
        await AuthApi.login(login: login, password: secret);
      }
      if (!mounted) return;
      await context.router.replaceAll([const HomeShellRoute()]);
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  Future<void> _sendPin() async {
    final email = _login.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Enter your account email to receive a PIN.');
      return;
    }
    setState(() {
      _sendingPin = true;
      _error = null;
      _mode = _LoginMode.pin;
    });
    try {
      AppToast.success(await AuthApi.requestPin(email));
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _sendingPin = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPin = _mode == _LoginMode.pin;
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 20, 20, 32),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Back to the public home page it was opened from.
                      if (context.router.canPop())
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 4),
                          child: IconButton(
                            tooltip: 'Back',
                            onPressed: () => context.router.maybePop(),
                            icon: const Icon(Icons.arrow_back_rounded),
                          ),
                        ),
                      const Expanded(child: AuthBrand()),
                    ],
                  ),
                  const SizedBox(height: 40),
                  const Text(
                    'Welcome back!',
                    style: TextStyle(
                      color: AppColors.authPurple,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _copy.loginTitle,
                    style: const TextStyle(
                      color: Color(0xFF111111),
                      fontSize: 34,
                      height: 1.06,
                      letterSpacing: -.8,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _copy.loginSubtitle,
                    style: const TextStyle(
                      color: AppColors.authBody,
                      fontSize: 15,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 24),
                  AuthSegmented(
                    labels: const ['Password', 'One-time PIN'],
                    selected: _mode.index,
                    onChanged: (i) => setState(() {
                      _mode = _LoginMode.values[i];
                      _error = null;
                    }),
                  ),
                  const SizedBox(height: 24),
                  AuthField(
                    label: 'Email or Phone Number',
                    controller: _login,
                    icon: Icons.person_outline_rounded,
                    hint: 'you@example.com',
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [
                      AutofillHints.email,
                      AutofillHints.telephoneNumber,
                    ],
                  ),
                  const SizedBox(height: 24),
                  if (isPin)
                    AuthField(
                      label: '6-digit PIN from your login email',
                      controller: _pin,
                      icon: Icons.verified_user_outlined,
                      hint: '000000',
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      digitsOnly: true,
                      letterSpacing: 6,
                      onSubmitted: (_) => _submit(),
                      helper: 'The PIN and direct link use the expiry chosen '
                          'by your administrator and work once.',
                    )
                  else
                    AuthField(
                      label: 'Password',
                      controller: _password,
                      icon: Icons.lock_outline_rounded,
                      hint: 'Password',
                      obscure: _obscure,
                      autofillHints: const [AutofillHints.password],
                      onSubmitted: (_) => _submit(),
                      trailing: IconButton(
                        tooltip: _obscure ? 'Show password' : 'Hide password',
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.authMuted,
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: TextButton(
                      onPressed: _sendingPin ? null : _sendPin,
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.authPurple,
                      ),
                      child: Text(
                        _sendingPin
                            ? 'Sending…'
                            : isPin
                            ? 'Email me a PIN'
                            : 'Forgot password?',
                      ),
                    ),
                  ),
                  if (_error != null) AuthErrorBox(message: _error!),
                  const SizedBox(height: 20),
                  AuthGradientButton(
                    label: 'Log in',
                    pending: _pending,
                    onPressed: _submit,
                  ),
                  const SizedBox(height: 24),
                  Center(
                    child: Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text('New here?',
                            style: TextStyle(color: AppColors.authMuted)),
                        TextButton(
                          onPressed: () =>
                              context.router.push(const RegisterRoute()),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.authPurple,
                          ),
                          child: const Text('Create an account',
                              style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  const AuthBenefits(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
