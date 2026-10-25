import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallerista/core/network/api_error.dart';
import 'package:gallerista/pages/home_page.dart';
import 'package:gallerista/theme/app_theme.dart';

DioException _errorWithBody(Object? body) {
  final options = RequestOptions(path: '/test');
  return DioException(
    requestOptions: options,
    response: Response(requestOptions: options, statusCode: 400, data: body),
    type: DioExceptionType.badResponse,
  );
}

void main() {
  group('ApiError.message', () {
    test('reads a plain NestJS message', () {
      final error = _errorWithBody({'message': 'Invalid credentials'});
      expect(ApiError.message(error), 'Invalid credentials');
    });

    test('joins validation messages', () {
      final error = _errorWithBody({
        'message': ['email must be an email', 'password is too short'],
      });
      expect(
        ApiError.message(error),
        'email must be an email\npassword is too short',
      );
    });

    test('falls back on connection errors', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.connectionError,
      );
      expect(ApiError.message(error), contains('Could not connect'));
    });
  });

  testWidgets('home page renders with the editorial theme', (tester) async {
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light, home: const HomePage()),
    );

    expect(find.text('Gallerista'), findsWidgets);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, isNull); // comes from the theme
    final theme = Theme.of(tester.element(find.byType(Scaffold)));
    expect(theme.scaffoldBackgroundColor, AppColors.galleryBackground);
    expect(theme.colorScheme.primary, AppColors.galleryPrimary);
  });
}
