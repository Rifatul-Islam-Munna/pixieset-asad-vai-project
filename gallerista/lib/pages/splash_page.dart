import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:gallerista/core/storage/session_storage.dart';
import 'package:gallerista/pages/auth/auth_widgets.dart';
import 'package:gallerista/router/app_router.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Decides where the app starts: galleries when signed in, login otherwise.
@RoutePage()
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    _route();
  }

  Future<void> _route() async {
    final loggedIn = await SessionStorage.isLoggedIn;
    if (!mounted) return;
    await context.router.replaceAll([
      if (loggedIn) const HomeShellRoute() else const LoginRoute(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.white,
      body: Center(child: AuthBrand()),
    );
  }
}
