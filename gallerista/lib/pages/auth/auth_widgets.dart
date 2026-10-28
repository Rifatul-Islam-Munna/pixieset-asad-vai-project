import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gallerista/core/cms/site_brand.dart';
import 'package:gallerista/core/cms/site_logo.dart';
import 'package:gallerista/theme/app_theme.dart';

/// Shared pieces of the login screen, styled after
/// `frontend/components/auth/auth-pages.tsx`.
///
/// The brand is the website's own, uploaded by the admin: its logo when one
/// is set, else its icon and name, else the built-in Gallerista mark.
class AuthBrand extends StatelessWidget {
  const AuthBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return const Align(
      alignment: AlignmentDirectional.centerStart,
      // Shrink to the logo, so it stays centered where a parent centers it
      // (splash) and left-aligned where it gets the full width (login).
      widthFactor: 1,
      child: SiteLogo(height: 34, fallback: _IconAndName()),
    );
  }
}

class _IconAndName extends StatelessWidget {
  const _IconAndName();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SiteIcon(
          size: 36,
          fallback: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              gradient: const LinearGradient(
                colors: [AppColors.authGradientStart, AppColors.authGradientEnd],
              ),
            ),
            child: const Icon(Icons.photo_library_outlined,
                color: AppColors.white, size: 20),
          ),
        ),
        const SizedBox(width: 10),
        ValueListenableBuilder<SiteBrand>(
          valueListenable: SiteBrand.current,
          builder: (_, brand, _) => Text(
            brand.name,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class AuthSegmented extends StatelessWidget {
  const AuthSegmented({
    super.key,
    required this.labels,
    required this.selected,
    required this.onChanged,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.authBackground,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppColors.authBorder),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Semantics(
                button: true,
                selected: i == selected,
                child: GestureDetector(
                  onTap: () => onChanged(i),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    decoration: BoxDecoration(
                      color: i == selected ? AppColors.white : null,
                      borderRadius: BorderRadius.circular(7),
                      boxShadow: i == selected
                          ? const [
                              BoxShadow(
                                color: Color(0x14000000),
                                blurRadius: 3,
                                offset: Offset(0, 1),
                              ),
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      labels[i],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: i == selected
                            ? AppColors.authPurple
                            : AppColors.authMuted,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    required this.icon,
    this.hint,
    this.obscure = false,
    this.trailing,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onSubmitted,
    this.maxLength,
    this.digitsOnly = false,
    this.letterSpacing,
    this.helper,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final String? hint;
  final bool obscure;
  final Widget? trailing;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final int? maxLength;
  final bool digitsOnly;
  final double? letterSpacing;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: BorderSide(color: color, width: width),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
        const SizedBox(height: 10),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          onSubmitted: onSubmitted,
          maxLength: maxLength,
          inputFormatters: [
            if (digitsOnly) FilteringTextInputFormatter.digitsOnly,
          ],
          style: TextStyle(
            fontSize: letterSpacing != null ? 20 : 16,
            letterSpacing: letterSpacing,
          ),
          decoration: InputDecoration(
            hintText: hint,
            counterText: '',
            filled: true,
            fillColor: AppColors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 18),
            prefixIcon: Padding(
              padding: const EdgeInsetsDirectional.only(start: 14, end: 10),
              child: Icon(icon, color: AppColors.authMuted, size: 20),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 44),
            suffixIcon: trailing,
            border: border(AppColors.authBorder),
            enabledBorder: border(AppColors.authBorder),
            focusedBorder: border(AppColors.authFocus, 1.5),
          ),
        ),
        if (helper != null) ...[
          const SizedBox(height: 8),
          Text(helper!,
              style: const TextStyle(
                  fontSize: 12, height: 1.6, color: AppColors.authMuted)),
        ],
      ],
    );
  }
}

class AuthErrorBox extends StatelessWidget {
  const AuthErrorBox({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: Color(0xFFDC2626),
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class AuthGradientButton extends StatelessWidget {
  const AuthGradientButton({
    super.key,
    required this.label,
    required this.pending,
    required this.onPressed,
  });

  final String label;
  final bool pending;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !pending,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          gradient: const LinearGradient(
            colors: [AppColors.authGradientStart, AppColors.authGradientEnd],
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x3D5F35C8),
              blurRadius: 28,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: pending ? null : onPressed,
            child: SizedBox(
              height: 56,
              width: double.infinity,
              child: Center(
                child: pending
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: AppColors.white,
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            label,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward_rounded,
                              color: AppColors.white, size: 20),
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

/// The three benefits from the web login's image panel.
class AuthBenefits extends StatelessWidget {
  const AuthBenefits({super.key});

  static const _items = [
    (Icons.image_outlined, 'Manage Galleries',
        'Organize and manage all your client galleries.'),
    (Icons.verified_user_outlined, 'Secure & Private',
        'Enterprise-grade security for your data.'),
    (Icons.insights_outlined, 'Grow Your Business',
        'Powerful tools to streamline and grow your business.'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final (icon, title, text) in _items)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF7645DF)),
                  ),
                  child: Icon(icon, color: const Color(0xFF8C56EF), size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(text,
                          style: const TextStyle(
                              fontSize: 12.5,
                              height: 1.5,
                              color: AppColors.authMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
