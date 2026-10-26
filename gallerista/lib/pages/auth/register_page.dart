import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/auth/auth_api.dart';
import 'package:gallerista/core/auth/auth_cms.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/pages/auth/auth_widgets.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Create-account screen, matching the web `RegisterPageClient`
/// (Google sign-in intentionally not included).
@RoutePage()
class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _gender = '';
  var _obscure = true;
  var _pending = false;
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
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final problem = AuthApi.validateRegistration(
      name: _name.text,
      phoneNumber: _phone.text,
      password: _password.text,
      email: _email.text,
    );
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await AuthApi.register(
        name: _name.text,
        phoneNumber: _phone.text,
        password: _password.text,
        email: _email.text,
        gender: _gender,
      );
      if (!mounted) return;
      await context.router.replaceAll([const HomeShellRoute()]);
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.message(e));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 20, 20, 32),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 470),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const AuthBrand(),
                    const SizedBox(height: 36),
                    const Text(
                      'Start creating today',
                      style: TextStyle(
                        color: AppColors.authPurple,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _copy.registerTitle,
                      style: const TextStyle(
                        color: Color(0xFF111111),
                        fontSize: 34,
                        height: 1.08,
                        letterSpacing: -.8,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _copy.registerSubtitle,
                      style: const TextStyle(
                        color: AppColors.authBody,
                        fontSize: 15,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 28),
                    AuthField(
                      label: 'Full Name',
                      controller: _name,
                      icon: Icons.person_outline_rounded,
                      hint: 'Your name',
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.name],
                    ),
                    const SizedBox(height: 18),
                    AuthField(
                      label: 'Phone Number',
                      controller: _phone,
                      icon: Icons.phone_outlined,
                      hint: '01712345678',
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.telephoneNumber],
                    ),
                    const SizedBox(height: 18),
                    AuthField(
                      label: 'Email Address (optional)',
                      controller: _email,
                      icon: Icons.mail_outline_rounded,
                      hint: 'you@example.com',
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                    ),
                    const SizedBox(height: 18),
                    const Text('Gender (optional)',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final g in const ['Female', 'Male', 'Other'])
                          ChoiceChip(
                            label: Text(g),
                            selected: _gender == g,
                            showCheckmark: false,
                            selectedColor: AppColors.galleryLavenderTint,
                            side: BorderSide(
                              color: _gender == g
                                  ? AppColors.authFocus
                                  : AppColors.authBorder,
                            ),
                            labelStyle: TextStyle(
                              color: _gender == g
                                  ? AppColors.authPurple
                                  : AppColors.authBody,
                              fontWeight: FontWeight.w600,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            onSelected: (_) => setState(
                              () => _gender = _gender == g ? '' : g,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    AuthField(
                      label: 'Password',
                      controller: _password,
                      icon: Icons.lock_outline_rounded,
                      hint: 'Create password (6+ characters)',
                      obscure: _obscure,
                      autofillHints: const [AutofillHints.newPassword],
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
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      AuthErrorBox(message: _error!),
                    ],
                    const SizedBox(height: 24),
                    AuthGradientButton(
                      label: 'Create account',
                      pending: _pending,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: 24),
                    Center(
                      child: Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const Text('Already have an account?',
                              style: TextStyle(color: AppColors.authMuted)),
                          TextButton(
                            onPressed: () => context.router.replaceAll(
                              [const LoginRoute()],
                            ),
                            style: TextButton.styleFrom(
                              foregroundColor: AppColors.authPurple,
                            ),
                            child: const Text('Log in',
                                style: TextStyle(fontWeight: FontWeight.w600)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
