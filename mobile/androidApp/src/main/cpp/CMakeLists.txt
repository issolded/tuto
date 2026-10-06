cmake_minimum_required(VERSION 3.22)
project(tuto_quickjs C)
include(FetchContent)

# Same sources as the alpha13 JVM classes, including their exact submodule revisions.
# Source licenses remain in the checkout (QuickJS and quickjs-kt: MIT).
FetchContent_Declare(quickjs_upstream
    GIT_REPOSITORY https://github.com/dokar3/quickjs-kt.git
    GIT_TAG d2fefdc451678d09bbef5526c3b00f12e41cd5cf
    GIT_SUBMODULES quickjs/native/quickjs quickjs/native/c-vector
    GIT_SUBMODULES_RECURSE FALSE
)
FetchContent_GetProperties(quickjs_upstream)
if(NOT quickjs_upstream_POPULATED)
    FetchContent_Populate(quickjs_upstream)
endif()
set(TARGET_PLATFORM android)
set(LIBRARY_TYPE shared)
set(BUILD_WITH_JNI ON CACHE BOOL "Build QuickJS JNI" FORCE)
add_subdirectory(${quickjs_upstream_SOURCE_DIR}/quickjs/native ${CMAKE_CURRENT_BINARY_DIR}/quickjs)
target_compile_options(quickjs PRIVATE -Os -fstrict-aliasing -fvisibility=hidden)
# Explicit in addition to NDK r28 defaults; both 4 KiB and 16 KiB devices can load this.
target_link_options(quickjs PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,-z,common-page-size=16384")
