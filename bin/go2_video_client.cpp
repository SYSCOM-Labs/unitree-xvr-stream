#include <unitree/robot/go2/video/video_client.hpp>
#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>

using namespace unitree::robot;

int main(int argc, char** argv)
{
    if (argc < 3)
    {
        std::cerr << "Usage: " << argv[0] << " networkInterface rtspUrl" << std::endl;
        std::cerr << "Example: " << argv[0] << " enxXXXXXXXXXXXX rtsp://127.0.0.1:8554/go2w" << std::endl;
        exit(-1);
    }

    const std::string network_interface = argv[1];
    const std::string rtsp_url = argv[2];

    std::cerr << "Initializing with network interface: " << network_interface << std::endl;
    std::cerr << "Publishing RTSP stream to: " << rtsp_url << std::endl;

    ChannelFactory::Instance()->Init(0, argv[1]);

    go2::VideoClient video_client;

    video_client.SetTimeout(1.0f);
    video_client.Init();

    std::ostringstream ffmpeg_command;
    ffmpeg_command
        << "ffmpeg -loglevel warning "
        << "-fflags nobuffer -flags low_delay "
        << "-f mjpeg -i - "
        << "-an "
        << "-c:v libx264 -pix_fmt yuv420p "
        << "-preset ultrafast -tune zerolatency "
        << "-g 10 -keyint_min 10 "
        << "-rtsp_transport tcp "
        << "-f rtsp \"" << rtsp_url << "\"";

    FILE* ffmpeg_pipe = popen(ffmpeg_command.str().c_str(), "w");
    if (ffmpeg_pipe == nullptr) {
        std::cerr << "Failed to start ffmpeg. Make sure it is installed and in PATH." << std::endl;
        return 1;
    }

    std::vector<uint8_t> image_sample;
    int fail_count = 0;

    while (true)
    {
        const int ret = video_client.GetImageSample(image_sample);

        if (ret == 0) {
            fail_count = 0;

            if (std::fwrite(image_sample.data(), 1, image_sample.size(), ffmpeg_pipe) != image_sample.size()) {
                std::cerr << "Failed to write frame to ffmpeg." << std::endl;
                break;
            }
            std::fflush(ffmpeg_pipe);
        } else {
            fail_count++;
            std::cerr << "GetImageSample failed (ret=" << ret << "), attempt #" << fail_count << std::endl;

            if (fail_count > 10) {
                std::cerr << "Too many failures. Check network connection and robot status." << std::endl;
                break;
            }
        }
    }

    pclose(ffmpeg_pipe);
    return 0;
}